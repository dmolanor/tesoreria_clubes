-- Acuerdos de pago: el tesorero registra fechas y montos pactados con un jugador para
-- cubrir una obligación. Solo el tesorero los crea y edita (el jugador y el futuro bot
-- de WhatsApp solo leen los propios); la base lo exige, no solo la app.
-- El estado de cada cuota se deriva de lo pagado en la obligación, no se guarda.

create type public.estado_acuerdo as enum ('activo', 'cancelado');
alter type public.tipo_bitacora add value 'acuerdo_pago_cambiado';
alter type public.objetivo_bitacora add value 'acuerdo_pago';

create table public.acuerdos_pago (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null,
  miembro_id    uuid not null,
  obligacion_id uuid not null,  -- la deuda que cubre el acuerdo
  notas         text,
  estado        public.estado_acuerdo not null default 'activo',
  creado_por    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (club_id, id),
  foreign key (club_id, miembro_id) references public.miembros (club_id, id),
  foreign key (club_id, obligacion_id) references public.obligaciones (club_id, id),
  foreign key (club_id, creado_por) references public.miembros (club_id, id)
);
-- Una obligación tiene como máximo un acuerdo activo a la vez.
create unique index acuerdos_un_activo_por_obligacion on public.acuerdos_pago (obligacion_id)
  where estado = 'activo';
create index acuerdos_miembro_idx on public.acuerdos_pago (club_id, miembro_id);
create index acuerdos_obligacion_idx on public.acuerdos_pago (club_id, obligacion_id);
create index acuerdos_creado_por_idx on public.acuerdos_pago (club_id, creado_por);

create table public.cuotas_acuerdo (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null,
  acuerdo_id uuid not null,
  numero     int not null check (numero > 0),
  fecha      date not null,
  monto      numeric(14, 2) not null check (monto > 0),
  created_at timestamptz not null default now(),
  unique (acuerdo_id, numero),
  foreign key (club_id, acuerdo_id) references public.acuerdos_pago (club_id, id) on delete cascade
);
create index cuotas_acuerdo_idx on public.cuotas_acuerdo (club_id, acuerdo_id, numero);

create trigger set_updated_at before update on public.acuerdos_pago
  for each row execute function private.set_updated_at();
create trigger set_creado_por before insert on public.acuerdos_pago
  for each row execute function private.set_creado_por();

-- ---------- Invariantes ----------

create function private.acuerdos_validar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_miembro uuid;
begin
  select o.miembro_id into v_miembro from public.obligaciones o where o.id = new.obligacion_id;
  if v_miembro is distinct from new.miembro_id then
    raise exception 'El acuerdo y la deuda son de jugadores distintos' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger validar before insert or update on public.acuerdos_pago
  for each row execute function private.acuerdos_validar();

-- Un acuerdo cancelado no se reprograma: se crea uno nuevo.
create function private.cuotas_validar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_estado public.estado_acuerdo;
  v_acuerdo uuid := coalesce(new.acuerdo_id, old.acuerdo_id);
begin
  select a.estado into v_estado from public.acuerdos_pago a where a.id = v_acuerdo;
  if v_estado = 'cancelado' then
    raise exception 'Este acuerdo está cancelado. Crea uno nuevo en vez de editarlo' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger validar before insert or update or delete on public.cuotas_acuerdo
  for each row execute function private.cuotas_validar();

-- ---------- Bitácora ----------

create function private.acuerdos_bitacora() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r public.acuerdos_pago := coalesce(new, old);
  v_accion text;
  v_total numeric;
  v_n int;
  v_jugador text := private.nombre_miembro(r.miembro_id);
  v_evento text;
begin
  v_accion := case
    when tg_op = 'INSERT' then 'registró'
    when new.estado = 'cancelado' and old.estado = 'activo' then 'canceló'
    when new.estado = 'activo' and old.estado = 'cancelado' then 'reactivó'
    when new.notas is distinct from old.notas then 'editó'
  end;
  if v_accion is null then
    return null;
  end if;
  select e.nombre into v_evento
  from public.obligaciones o join public.eventos_cobro e on e.id = o.evento_id
  where o.id = r.obligacion_id;
  -- Al crear, las cuotas aún no existen (se insertan después): sin totales.
  if tg_op = 'INSERT' then
    perform private.registrar(r.club_id, 'acuerdo_pago_cambiado', 'acuerdo_pago', r.id,
      format('%s registró un acuerdo de pago de %s para "%s"',
             private.actor(r.club_id), v_jugador, coalesce(v_evento, '?')),
      jsonb_build_object('accion', v_accion));
    return null;
  end if;
  select coalesce(sum(c.monto), 0), count(*) into v_total, v_n
  from public.cuotas_acuerdo c where c.acuerdo_id = r.id;
  perform private.registrar(r.club_id, 'acuerdo_pago_cambiado', 'acuerdo_pago', r.id,
    format('%s %s el acuerdo de pago de %s (%s en %s %s, para "%s")',
           private.actor(r.club_id), v_accion, v_jugador, private.cop(v_total), v_n,
           case when v_n = 1 then 'cuota' else 'cuotas' end, coalesce(v_evento, '?')),
    jsonb_build_object('accion', v_accion, 'total', v_total, 'cuotas', v_n));
  return null;
end;
$$;
create trigger bitacora after insert or update on public.acuerdos_pago
  for each row execute function private.acuerdos_bitacora();

-- Las cuotas se registran al crear el acuerdo; solo los ajustes posteriores dejan rastro,
-- uno por sentencia (un ajuste reescribe las cuotas en bloque).
create function private.cuotas_bitacora() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_acuerdo_id uuid;
  v_acuerdo public.acuerdos_pago;
begin
  if tg_op = 'DELETE' then
    select c.acuerdo_id into v_acuerdo_id from old_cuotas c limit 1;
  else
    select c.acuerdo_id into v_acuerdo_id from new_cuotas c limit 1;
  end if;
  if v_acuerdo_id is null then
    return null;
  end if;
  select * into v_acuerdo from public.acuerdos_pago where id = v_acuerdo_id;
  perform private.registrar(v_acuerdo.club_id, 'acuerdo_pago_cambiado', 'acuerdo_pago', v_acuerdo.id,
    format('%s ajustó las cuotas del acuerdo de pago de %s',
           private.actor(v_acuerdo.club_id), private.nombre_miembro(v_acuerdo.miembro_id)),
    jsonb_build_object('accion', 'cuotas_ajustadas'));
  return null;
end;
$$;
create trigger bitacora_update after update on public.cuotas_acuerdo
  referencing old table as old_cuotas new table as new_cuotas
  for each statement execute function private.cuotas_bitacora();
create trigger bitacora_delete after delete on public.cuotas_acuerdo
  referencing old table as old_cuotas
  for each statement execute function private.cuotas_bitacora();

-- ---------- RLS: tesorería escribe, el jugador lee lo suyo, administración lee ----------

alter table public.acuerdos_pago enable row level security;
alter table public.cuotas_acuerdo enable row level security;

grant select on public.acuerdos_pago, public.cuotas_acuerdo to authenticated;
grant insert (club_id, miembro_id, obligacion_id, notas) on public.acuerdos_pago to authenticated;
grant update (notas, estado) on public.acuerdos_pago to authenticated;
grant insert (club_id, acuerdo_id, numero, fecha, monto) on public.cuotas_acuerdo to authenticated;
grant update (numero, fecha, monto) on public.cuotas_acuerdo to authenticated;
grant delete on public.cuotas_acuerdo to authenticated;

create policy "Cada jugador ve sus acuerdos; tesorería y administración ven el club" on public.acuerdos_pago
  for select to authenticated
  using (miembro_id = any ((select private.mis_miembros())::uuid[])
         or club_id = any ((select private.clubes_con_rol('{tesorero,administrativo}'))::uuid[]));
create policy "Tesorería registra acuerdos" on public.acuerdos_pago for insert to authenticated
  with check (club_id = any ((select private.clubes_con_rol('{tesorero}'))::uuid[]));
create policy "Tesorería edita acuerdos" on public.acuerdos_pago for update to authenticated
  using (club_id = any ((select private.clubes_con_rol('{tesorero}'))::uuid[]))
  with check (club_id = any ((select private.clubes_con_rol('{tesorero}'))::uuid[]));

create policy "Cada jugador ve sus cuotas; tesorería y administración ven el club" on public.cuotas_acuerdo
  for select to authenticated
  using (club_id = any ((select private.clubes_con_rol('{tesorero,administrativo}'))::uuid[])
         or acuerdo_id in (select a.id from public.acuerdos_pago a
                           where a.miembro_id = any ((select private.mis_miembros())::uuid[])));
create policy "Tesorería programa cuotas" on public.cuotas_acuerdo for insert to authenticated
  with check (club_id = any ((select private.clubes_con_rol('{tesorero}'))::uuid[]));
create policy "Tesorería ajusta cuotas" on public.cuotas_acuerdo for update to authenticated
  using (club_id = any ((select private.clubes_con_rol('{tesorero}'))::uuid[]))
  with check (club_id = any ((select private.clubes_con_rol('{tesorero}'))::uuid[]));
create policy "Tesorería quita cuotas" on public.cuotas_acuerdo for delete to authenticated
  using (club_id = any ((select private.clubes_con_rol('{tesorero}'))::uuid[]));

-- ---------- Progreso por evento: obligaciones con acuerdo activo (tercer segmento) ----------

create or replace view public.progreso_eventos with (security_invoker = true) as
select
  e.id as evento_id,
  e.club_id,
  count(o.id)::int as total,
  (count(o.id) filter (where o.pagado >= o.monto))::int as pagadas,
  coalesce(sum(o.pagado), 0)::numeric(14, 2) as recaudado,
  coalesce(sum(o.monto), 0)::numeric(14, 2) as monto_total,
  (count(o.id) filter (where o.pagado < o.monto
    and exists (select 1 from public.acuerdos_pago a
                where a.obligacion_id = o.id and a.estado = 'activo')))::int as con_acuerdo
from public.eventos_cobro e
left join public.obligaciones o on o.evento_id = e.id
group by e.id, e.club_id;
