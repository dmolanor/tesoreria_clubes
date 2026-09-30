-- Egresos del club (arriendo de cancha, árbitros, equipamiento, federación/liga) y cuadre mensual
-- que los descuenta: diferencia = movimiento del banco − (ingresos aceptados − egresos del mes).
-- Una sola cuenta por club, igual que `conciliaciones` (no hay tabla de cuentas bancarias).

-- ---------- Tipos ----------

create type public.categoria_egreso as enum ('arriendo_cancha', 'arbitros', 'equipamiento', 'federacion', 'otro');

-- Valores nuevos de los enums cerrados de la bitácora (decisión deliberada, ver docs/02).
-- Solo se usan dentro de cuerpos plpgsql, así que no chocan con la transacción de la migración.
alter type public.tipo_bitacora add value if not exists 'egreso_registrado';
alter type public.tipo_bitacora add value if not exists 'egreso_anulado';
alter type public.objetivo_bitacora add value if not exists 'egreso';

-- ---------- Tabla ----------

-- En finanzas no se borra: un egreso registrado por error se anula (`anulado_en`) y deja de contar.
create table public.egresos (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubes (id),
  fecha        date not null,                    -- fecha en que salió la plata: la usa la conciliación
  monto        numeric(14, 2) not null check (monto > 0),
  concepto     text not null check (length(trim(concepto)) > 0),
  categoria    public.categoria_egreso not null default 'otro',
  soporte_path text,                             -- factura o recibo en Storage (bucket `comprobantes`)
  creado_por   uuid,
  anulado_en   timestamptz,
  created_at   timestamptz not null default now(),
  unique (club_id, id),
  foreign key (club_id, creado_por) references public.miembros (club_id, id),
  -- El soporte vive en la carpeta de egresos del mismo club.
  check (soporte_path is null or soporte_path like club_id::text || '/egresos/%')
);
create index egresos_club_fecha_idx on public.egresos (club_id, fecha);
create index egresos_creado_por_idx on public.egresos (club_id, creado_por);

-- ---------- Triggers ----------

create trigger set_creado_por before insert on public.egresos
  for each row execute function private.set_creado_por();

create function private.egresos_validar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.fecha > private.hoy(new.club_id) then
      raise exception 'La fecha del egreso no puede ser posterior a hoy' using errcode = '23514';
    end if;
    return new;
  end if;
  if old.anulado_en is not null then
    raise exception 'Este egreso ya estaba anulado' using errcode = '23514';
  end if;
  if (new.club_id, new.fecha, new.monto, new.concepto, new.categoria, new.soporte_path, new.creado_por) is distinct from
     (old.club_id, old.fecha, old.monto, old.concepto, old.categoria, old.soporte_path, old.creado_por) then
    raise exception 'Un egreso no se edita: se anula y se registra otro' using errcode = '23514';
  end if;
  if new.anulado_en is not null then
    new.anulado_en := now();  -- la hora la pone la base, no el cliente
  end if;
  return new;
end;
$$;
create trigger validar before insert or update on public.egresos
  for each row execute function private.egresos_validar();

create function private.egresos_bitacora() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.registrar(new.club_id, 'egreso_registrado', 'egreso', new.id,
      format('%s registró un egreso de %s: %s', private.actor(new.club_id), private.cop(new.monto), new.concepto),
      jsonb_build_object('monto', new.monto, 'categoria', new.categoria, 'fecha', new.fecha));
  elsif new.anulado_en is not null and old.anulado_en is null then
    perform private.registrar(new.club_id, 'egreso_anulado', 'egreso', new.id,
      format('%s anuló el egreso de %s: %s', private.actor(new.club_id), private.cop(new.monto), new.concepto),
      jsonb_build_object('monto', new.monto, 'categoria', new.categoria, 'fecha', new.fecha));
  end if;
  return null;
end;
$$;
create trigger bitacora after insert or update on public.egresos
  for each row execute function private.egresos_bitacora();

-- ---------- RLS: tesorería registra y anula; administración solo lee; el jugador no ve nada ----------

grant select on public.egresos to authenticated;
grant insert (club_id, fecha, monto, concepto, categoria, soporte_path) on public.egresos to authenticated;
grant update (anulado_en) on public.egresos to authenticated;  -- anular es la única edición
-- Sin delete.

alter table public.egresos enable row level security;

create policy "Tesorería y administración ven los egresos" on public.egresos for select to authenticated
  using (club_id = any ((select private.clubes_con_rol('{tesorero,administrativo}'))::uuid[]));
create policy "Tesorería registra egresos" on public.egresos for insert to authenticated
  with check (club_id = any ((select private.clubes_con_rol('{tesorero}'))::uuid[]));
create policy "Tesorería anula egresos" on public.egresos for update to authenticated
  using (club_id = any ((select private.clubes_con_rol('{tesorero}'))::uuid[]))
  with check (club_id = any ((select private.clubes_con_rol('{tesorero}'))::uuid[]));

-- ---------- Storage: soportes en el bucket `comprobantes`, ruta {club_id}/egresos/{uuid}.{ext} ----------
-- La lectura ya la cubre la política existente (tesorería y administración leen `{club_id}/…`);
-- un jugador no la ve porque `egresos` no es un id de miembro.

create policy "Soportes de egresos: tesorería sube a la carpeta del club"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'comprobantes'
  and (storage.foldername(name))[2] = 'egresos'
  and private.uuid_o_null((storage.foldername(name))[1]) = any ((select private.clubes_con_rol('{tesorero}'))::uuid[])
);

-- ---------- Cuadre de la conciliación ----------

alter table public.conciliaciones add column total_egresos numeric(14, 2) not null default 0;  -- snapshot; lo calcula un trigger
-- Una columna generada no se redefine: se reemplaza. Con total_egresos = 0 da lo mismo que antes.
alter table public.conciliaciones drop column diferencia;
alter table public.conciliaciones add column diferencia numeric(14, 2)
  generated always as (saldo_final - saldo_inicial - (total_aceptado - total_egresos)) stored;

-- `total_egresos` = egresos no anulados cuya fecha cae en el mes. Snapshot al guardar, como `total_aceptado`.
create or replace function private.conciliaciones_calcular() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.total_aceptado := (
    select coalesce(sum(c.monto), 0) from public.comprobantes c
    where c.club_id = new.club_id and c.estado = 'aceptado'
      and c.fecha_pago >= new.mes and c.fecha_pago < (new.mes + interval '1 month')::date
  );
  new.total_egresos := (
    select coalesce(sum(e.monto), 0) from public.egresos e
    where e.club_id = new.club_id and e.anulado_en is null
      and e.fecha >= new.mes and e.fecha < (new.mes + interval '1 month')::date
  );
  if tg_op = 'INSERT' and (select auth.uid()) is not null then
    new.creado_por := private.miembro_actual(new.club_id);
  end if;
  return new;
end;
$$;

create or replace function private.conciliaciones_bitacora() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.registrar(new.club_id, 'conciliacion_guardada', 'conciliacion', new.id,
    format('%s guardó la conciliación de %s — diferencia %s', private.actor(new.club_id),
           to_char(new.mes, 'YYYY-MM'), private.cop(new.diferencia)),
    jsonb_build_object('total_aceptado', new.total_aceptado, 'total_egresos', new.total_egresos,
                       'diferencia', new.diferencia));
  return null;
end;
$$;
