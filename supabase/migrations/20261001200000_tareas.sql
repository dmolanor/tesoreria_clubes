-- Tareas no financieras (ej. diligenciar una encuesta, entregar el uniforme): la administración
-- las asigna con el mismo alcance que un evento de cobro, pero no mueven plata.
-- `crear_evento` (20260929223154_funciones.sql) es el patrón de alcance que sigue `crear_tarea`.

-- ---------- Tipos ----------

create type public.estado_tarea as enum ('activa', 'cancelada');

-- Valores nuevos de los enums cerrados de la bitácora (decisión deliberada, ver docs/02).
-- Solo se usan dentro de cuerpos plpgsql, así que no chocan con la transacción de esta migración.
alter type public.tipo_bitacora add value if not exists 'tarea_creada';
alter type public.tipo_bitacora add value if not exists 'tarea_cancelada';
alter type public.objetivo_bitacora add value if not exists 'tarea';

-- ---------- Tablas ----------

create table public.tareas (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubes (id),
  nombre       text not null check (length(trim(nombre)) > 0),
  fecha_limite date not null,
  alcance      public.alcance_cobro not null,
  categoria    text,  -- solo para alcance 'grupo'; 'individual' = tareas_miembros mismas
  link         text not null check (link ~ '^https://'),
  estado       public.estado_tarea not null default 'activa',
  creado_por   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (club_id, id),
  foreign key (club_id, creado_por) references public.miembros (club_id, id),
  check ((alcance = 'grupo') = (categoria is not null))
);
create index tareas_club_fecha_idx on public.tareas (club_id, estado, fecha_limite);
create index tareas_creado_por_idx on public.tareas (club_id, creado_por);

-- Quién tiene que hacer cada tarea y si ya la marcó como hecha.
create table public.tareas_miembros (
  tarea_id      uuid not null,
  miembro_id    uuid not null,
  club_id       uuid not null,
  completada_en timestamptz,
  primary key (tarea_id, miembro_id),
  foreign key (club_id, tarea_id) references public.tareas (club_id, id),
  foreign key (club_id, miembro_id) references public.miembros (club_id, id)
);
create index tareas_miembros_miembro_idx on public.tareas_miembros (club_id, miembro_id);
create index tareas_miembros_miembro_rls_idx on public.tareas_miembros (miembro_id);

create trigger set_updated_at before update on public.tareas
  for each row execute function private.set_updated_at();
create trigger set_creado_por before insert on public.tareas
  for each row execute function private.set_creado_por();

-- ---------- Bitácora: crear y cancelar, nunca cada check (CLAUDE.md, principio 5) ----------

create function private.tareas_bitacora() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.registrar(new.club_id, 'tarea_creada', 'tarea', new.id,
      format('%s creó la tarea "%s" (vence %s)', private.actor(new.club_id), new.nombre, to_char(new.fecha_limite, 'DD/MM/YYYY')),
      jsonb_build_object('alcance', new.alcance, 'categoria', new.categoria));
  elsif new.estado = 'cancelada' and old.estado <> 'cancelada' then
    perform private.registrar(new.club_id, 'tarea_cancelada', 'tarea', new.id,
      format('%s canceló la tarea "%s"', private.actor(new.club_id), new.nombre));
  end if;
  return null;
end;
$$;
create trigger bitacora after insert or update on public.tareas
  for each row execute function private.tareas_bitacora();

-- ---------- RPC: mismo alcance que crear_evento, solo administración ----------

create function public.crear_tarea(
  p_club_id uuid, p_nombre text, p_link text, p_fecha_limite date,
  p_alcance public.alcance_cobro, p_categoria text default null, p_miembro_ids uuid[] default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_tarea_id uuid;
  v_n int;
begin
  if not private.tiene_rol(p_club_id, '{administrativo}') then
    raise exception 'Solo la administración crea tareas' using errcode = '42501';
  end if;

  insert into public.tareas (club_id, nombre, link, fecha_limite, alcance, categoria)
  values (p_club_id, p_nombre, p_link, p_fecha_limite, p_alcance,
          case when p_alcance = 'grupo' then p_categoria end)
  returning id into v_tarea_id;

  insert into public.tareas_miembros (club_id, tarea_id, miembro_id)
  select p_club_id, v_tarea_id, m.id
  from public.miembros m
  where m.club_id = p_club_id and 'jugador' = any (m.roles)
    and case p_alcance
          when 'todos' then m.estado = 'activo'
          when 'grupo' then m.estado = 'activo' and m.categoria = p_categoria
          else m.id = any (coalesce(p_miembro_ids, '{}')) and m.estado <> 'retirado'
        end;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'El alcance elegido no incluye a ningún jugador activo' using errcode = '23514';
  end if;
  return v_tarea_id;
end;
$$;

create function public.cancelar_tarea(p_tarea_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_tarea public.tareas;
begin
  select * into v_tarea from public.tareas where id = p_tarea_id;
  if not found then
    raise exception 'Tarea no encontrada' using errcode = 'P0002';
  end if;
  if not private.tiene_rol(v_tarea.club_id, '{administrativo}') then
    raise exception 'Solo la administración cancela tareas' using errcode = '42501';
  end if;
  if v_tarea.estado = 'cancelada' then
    raise exception 'Esta tarea ya estaba cancelada' using errcode = '23514';
  end if;
  update public.tareas set estado = 'cancelada' where id = p_tarea_id;
end;
$$;

grant execute on function
  public.crear_tarea(uuid, text, text, date, public.alcance_cobro, text, uuid[]),
  public.cancelar_tarea(uuid)
to authenticated;

-- ---------- RLS ----------

alter table public.tareas enable row level security;
alter table public.tareas_miembros enable row level security;

grant select on public.tareas, public.tareas_miembros to authenticated;
grant insert (club_id, nombre, fecha_limite, alcance, categoria, link) on public.tareas to authenticated;
grant update (estado) on public.tareas to authenticated;  -- solo cancelar_tarea
grant insert (club_id, tarea_id, miembro_id) on public.tareas_miembros to authenticated;  -- solo vía crear_tarea
grant update (completada_en) on public.tareas_miembros to authenticated;  -- cada jugador, solo su fila

create policy "Tesorería y administración ven las tareas del club" on public.tareas for select to authenticated
  using (club_id = any ((select private.clubes_con_rol('{tesorero,administrativo}'))::uuid[]));
create policy "El jugador ve las tareas que le asignaron" on public.tareas for select to authenticated
  using (id in (select tm.tarea_id from public.tareas_miembros tm where tm.miembro_id = any ((select private.mis_miembros())::uuid[])));
create policy "Administración crea tareas" on public.tareas for insert to authenticated
  with check (club_id = any ((select private.clubes_con_rol('{administrativo}'))::uuid[]));
create policy "Administración cancela tareas" on public.tareas for update to authenticated
  using (club_id = any ((select private.clubes_con_rol('{administrativo}'))::uuid[]))
  with check (club_id = any ((select private.clubes_con_rol('{administrativo}'))::uuid[]));

create policy "El jugador ve sus asignaciones; tesorería y administración ven el club" on public.tareas_miembros
  for select to authenticated
  using (miembro_id = any ((select private.mis_miembros())::uuid[])
         or club_id = any ((select private.clubes_con_rol('{tesorero,administrativo}'))::uuid[]));
create policy "Administración asigna tareas" on public.tareas_miembros for insert to authenticated
  with check (club_id = any ((select private.clubes_con_rol('{administrativo}'))::uuid[]));
create policy "El jugador marca su propia tarea" on public.tareas_miembros for update to authenticated
  using (miembro_id = any ((select private.mis_miembros())::uuid[]))
  with check (miembro_id = any ((select private.mis_miembros())::uuid[]));
