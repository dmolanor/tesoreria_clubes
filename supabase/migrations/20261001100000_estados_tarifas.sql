-- Tarifas por estado, un estado nuevo "inactivo", bloqueo de retiro con deuda/saldo y condonación.
-- El prorrateo deja de tener un piso fijo (private.prorrateo_piso): ahora es incremental, sobre los
-- días que quedan del mes, usando la tarifa de cada estado (docs/02-data-model.md).

-- Valores nuevos de enums cerrados (decisión deliberada, ver docs/02). Solo se usan dentro de
-- cuerpos plpgsql más abajo, así que no chocan con la transacción de esta migración.
alter type public.estado_miembro add value if not exists 'inactivo';
alter type public.tipo_bitacora add value if not exists 'tarifa_cambiada';
alter type public.tipo_bitacora add value if not exists 'obligacion_condonada';
alter type public.objetivo_bitacora add value if not exists 'club';
alter type public.objetivo_bitacora add value if not exists 'obligacion';

-- ---------- Tarifas por estado ----------
-- Solo lesionado e inactivo tienen tarifa configurable: activo usa el monto de la mensualidad
-- del evento, y retirado es 0 (no se configuran, por eso el check de abajo).

create table public.tarifas_estado (
  club_id       uuid not null references public.clubes (id),
  estado        public.estado_miembro not null,
  monto_mensual numeric(14, 2) not null check (monto_mensual >= 0),
  updated_at    timestamptz not null default now(),
  primary key (club_id, estado),
  check (estado::text in ('lesionado', 'inactivo'))
);

create trigger set_updated_at before update on public.tarifas_estado
  for each row execute function private.set_updated_at();

create function private.tarifas_bitacora() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.registrar(new.club_id, 'tarifa_cambiada', 'club', new.club_id,
    format('%s configuró la tarifa de %s en %s', private.actor(new.club_id), new.estado, private.cop(new.monto_mensual)),
    jsonb_build_object('estado', new.estado, 'monto_mensual', new.monto_mensual));
  return null;
end;
$$;
create trigger bitacora after insert or update on public.tarifas_estado
  for each row execute function private.tarifas_bitacora();

alter table public.tarifas_estado enable row level security;

grant select on public.tarifas_estado to authenticated;
grant insert (club_id, estado, monto_mensual) on public.tarifas_estado to authenticated;
grant update (monto_mensual) on public.tarifas_estado to authenticated;

create policy "Tesorería y administración ven las tarifas" on public.tarifas_estado for select to authenticated
  using (club_id = any ((select private.clubes_con_rol('{tesorero,administrativo}'))::uuid[]));
create policy "Administración configura tarifas" on public.tarifas_estado for insert to authenticated
  with check (club_id = any ((select private.clubes_con_rol('{administrativo}'))::uuid[]));
create policy "Administración edita tarifas" on public.tarifas_estado for update to authenticated
  using (club_id = any ((select private.clubes_con_rol('{administrativo}'))::uuid[]))
  with check (club_id = any ((select private.clubes_con_rol('{administrativo}'))::uuid[]));

-- Tarifa de un estado para el prorrateo incremental: activo = el monto del evento de mensualidad;
-- retirado = 0; lesionado/inactivo = `tarifas_estado` (sin configurar, error claro).
create function private.tarifa_estado(p_club_id uuid, p_estado public.estado_miembro, p_monto_evento numeric) returns numeric
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_monto numeric;
begin
  if p_estado = 'activo' then
    return p_monto_evento;
  end if;
  if p_estado = 'retirado' then
    return 0;
  end if;
  select monto_mensual into v_monto from public.tarifas_estado where club_id = p_club_id and estado = p_estado;
  if not found then
    raise exception 'Configura la tarifa de % antes de cambiar el estado', p_estado using errcode = '23514';
  end if;
  return v_monto;
end;
$$;
grant execute on function private.tarifa_estado(uuid, public.estado_miembro, numeric) to authenticated;

-- ---------- Prorrateo incremental (reemplaza el piso del 50%) ----------

-- Cambia el estado de un jugador; prorratea la mensualidad del mes de la fecha efectiva con la
-- fórmula incremental: nuevo = monto_actual − tarifa(anterior)·r + tarifa(nuevo)·r, con
-- r = (días_del_mes − día_fecha + 1) / días_del_mes. Aplica a cualquier transición (activo↔lesionado↔
-- inactivo↔retirado), no solo al salir de activo. Si el estado nuevo es 'retirado', bloquea la
-- operación cuando queda deuda o saldo a favor sin resolver (y revierte el prorrateo que ya corrió).
create or replace function public.cambiar_estado_miembro(
  p_miembro_id uuid, p_estado public.estado_miembro, p_fecha_efectiva date default null
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_m public.miembros;
  v_hoy date;
  v_fecha date;
  v_obl record;
  v_tarifa_ant numeric;
  v_tarifa_nue numeric;
  v_dias_mes numeric;
  v_r numeric;
  v_nuevo numeric;
  v_detalle text[] := '{}';
  v_pendiente numeric;
  v_favor numeric;
begin
  select * into v_m from public.miembros where id = p_miembro_id;
  if not found then
    raise exception 'Jugador no encontrado' using errcode = 'P0002';
  end if;
  if not private.tiene_rol(v_m.club_id, '{administrativo}') then
    raise exception 'Solo la administración cambia el estado de un jugador' using errcode = '42501';
  end if;
  v_hoy := private.hoy(v_m.club_id);
  v_fecha := coalesce(p_fecha_efectiva, v_hoy);
  if v_fecha > v_hoy then
    raise exception 'La fecha efectiva (%) no puede ser posterior a hoy (%)',
      to_char(v_fecha, 'DD/MM/YYYY'), to_char(v_hoy, 'DD/MM/YYYY')
      using errcode = '23514';
  end if;
  if v_m.estado = p_estado then
    return;
  end if;

  for v_obl in
    select o.id, o.monto, e.nombre, e.monto as evento_monto
    from public.obligaciones o join public.eventos_cobro e on e.id = o.evento_id
    where o.miembro_id = p_miembro_id and e.estado = 'activo' and e.tipo = 'mensualidad'
      and date_trunc('month', e.fecha_limite) = date_trunc('month', v_fecha)
  loop
    v_tarifa_ant := private.tarifa_estado(v_m.club_id, v_m.estado, v_obl.evento_monto);
    v_tarifa_nue := private.tarifa_estado(v_m.club_id, p_estado, v_obl.evento_monto);
    v_dias_mes := extract(day from (date_trunc('month', v_fecha) + interval '1 month - 1 day'));
    v_r := (v_dias_mes - extract(day from v_fecha) + 1) / v_dias_mes;
    v_nuevo := greatest(round(v_obl.monto - v_tarifa_ant * v_r + v_tarifa_nue * v_r, -2), 0);
    if v_nuevo = v_obl.monto then
      continue;
    end if;
    if v_nuevo < v_obl.monto then
      -- Se anula lo aplicado, se ajusta el monto y se vuelve a aplicar hasta el nuevo valor.
      perform private.anular_aplicaciones(v_obl.id, 'Prorrateo por cambio de estado');
      update public.obligaciones set monto = v_nuevo where id = v_obl.id;
      perform private.aplicar_saldo_a_favor(v_obl.id);
    else
      -- Sube el monto (ej. vuelve a activo): el estado de la obligación se recalcula solo (columna generada).
      update public.obligaciones set monto = v_nuevo where id = v_obl.id;
    end if;
    v_detalle := v_detalle || format('%s: %s → %s', v_obl.nombre, private.cop(v_obl.monto), private.cop(v_nuevo));
  end loop;

  -- Retiro bloqueado si queda deuda o saldo a favor sin resolver (misma lógica que estado_cuenta_miembros).
  -- La excepción revierte también el prorrateo de arriba.
  if p_estado = 'retirado' then
    select coalesce(sum(o.monto - o.pagado), 0) into v_pendiente
    from public.obligaciones o join public.eventos_cobro e on e.id = o.evento_id
    where o.miembro_id = p_miembro_id and e.estado = 'activo' and o.pagado < o.monto;
    if v_pendiente > 0 then
      raise exception 'Queda debiendo %s con el prorrateo al %s. Cóbralo o condónalo antes de retirarlo',
        private.cop(v_pendiente), to_char(v_fecha, 'DD/MM/YYYY')
        using errcode = '23514';
    end if;
    select coalesce(sum(c.monto - coalesce((select sum(a.monto) from public.aplicaciones a
                                            where a.comprobante_id = c.id and a.anulada_en is null), 0)), 0) into v_favor
    from public.comprobantes c where c.miembro_id = p_miembro_id and c.estado = 'aceptado';
    if v_favor > 0 then
      raise exception 'Tiene %s a favor. Aplícalo o devuélvelo antes de retirarlo', private.cop(v_favor)
        using errcode = '23514';
    end if;
  end if;

  -- El trigger de bitácora del miembro incluye la fecha efectiva y el detalle del prorrateo.
  perform set_config('app.prorrateo', array_to_string(v_detalle, '; '), true);
  perform set_config('app.fecha_efectiva', v_fecha::text, true);
  update public.miembros set estado = p_estado where id = p_miembro_id;
  perform set_config('app.prorrateo', '', true);
  perform set_config('app.fecha_efectiva', '', true);
end;
$$;

-- Nadie más llama a `private.prorrateo_piso()` tras el `create or replace` de arriba.
drop function private.prorrateo_piso();

-- ---------- crear_evento: la mensualidad también cobra a lesionados e inactivos, a su tarifa ----------

create or replace function public.crear_evento(
  p_club_id uuid, p_nombre text, p_tipo public.tipo_cobro, p_monto numeric, p_fecha_limite date,
  p_alcance public.alcance_cobro, p_categoria text default null, p_miembro_ids uuid[] default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_evento_id uuid;
  v_obl record;
  v_n int;
begin
  if not private.tiene_rol(p_club_id, '{administrativo}') then
    raise exception 'Solo la administración crea eventos de cobro' using errcode = '42501';
  end if;

  insert into public.eventos_cobro (club_id, nombre, tipo, monto, fecha_limite, alcance, categoria)
  values (p_club_id, p_nombre, p_tipo, p_monto, p_fecha_limite, p_alcance,
          case when p_alcance = 'grupo' then p_categoria end)
  returning id into v_evento_id;

  -- Mensualidad con alcance 'todos'/'grupo': lesionados e inactivos también quedan cobrados, a su
  -- tarifa (sin obligación si el club no la configuró o la dejó en 0). Para 'individual' el monto lo
  -- elige la administración a mano, igual que siempre.
  insert into public.obligaciones (club_id, evento_id, miembro_id, monto)
  select p_club_id, v_evento_id, m.id,
    case
      when p_tipo = 'mensualidad' and p_alcance in ('todos', 'grupo') and m.estado <> 'activo'
        then (select t.monto_mensual from public.tarifas_estado t where t.club_id = p_club_id and t.estado = m.estado)
      else p_monto
    end
  from public.miembros m
  where m.club_id = p_club_id and 'jugador' = any (m.roles)
    and case p_alcance
          when 'todos' then
            m.estado = 'activo'
            or (p_tipo = 'mensualidad' and m.estado in ('lesionado', 'inactivo')
                and exists (select 1 from public.tarifas_estado t
                            where t.club_id = p_club_id and t.estado = m.estado and t.monto_mensual > 0))
          when 'grupo' then
            m.categoria = p_categoria and (
              m.estado = 'activo'
              or (p_tipo = 'mensualidad' and m.estado in ('lesionado', 'inactivo')
                  and exists (select 1 from public.tarifas_estado t
                              where t.club_id = p_club_id and t.estado = m.estado and t.monto_mensual > 0))
            )
          else m.id = any (coalesce(p_miembro_ids, '{}')) and m.estado <> 'retirado'
        end;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'El alcance elegido no incluye a ningún jugador activo' using errcode = '23514';
  end if;

  for v_obl in select id from public.obligaciones where evento_id = v_evento_id loop
    perform private.aplicar_saldo_a_favor(v_obl.id);
  end loop;
  return v_evento_id;
end;
$$;

-- ---------- Condonación: deja la obligación en lo ya pagado (monto = pagado) ----------
-- `security definer`: la condona tesorería, que no tiene permiso de UPDATE sobre `obligaciones`
-- (esa tabla es de administración); el rol se verifica aquí, igual que `private.anular_aplicaciones`.
create function public.condonar_obligacion(p_obligacion_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_obl public.obligaciones;
  v_condonado numeric;
begin
  select * into v_obl from public.obligaciones where id = p_obligacion_id;
  if not found then
    raise exception 'Obligación no encontrada' using errcode = 'P0002';
  end if;
  if not private.tiene_rol(v_obl.club_id, '{tesorero}') then
    raise exception 'Solo el tesorero condona obligaciones' using errcode = '42501';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Escribe el motivo de la condonación' using errcode = '23514';
  end if;
  v_condonado := v_obl.monto - v_obl.pagado;
  if v_condonado <= 0 then
    raise exception 'Esta obligación no tiene saldo pendiente para condonar' using errcode = '23514';
  end if;

  update public.obligaciones set monto = v_obl.pagado where id = p_obligacion_id;
  perform private.registrar(v_obl.club_id, 'obligacion_condonada', 'obligacion', p_obligacion_id,
    format('%s condonó %s', private.actor(v_obl.club_id), private.cop(v_condonado)),
    jsonb_build_object('monto_condonado', v_condonado, 'motivo', p_motivo));
end;
$$;

revoke execute on function public.condonar_obligacion(uuid, text) from public, anon;
grant execute on function public.condonar_obligacion(uuid, text) to authenticated;
