-- Funciones de negocio (RPC) y vistas.
-- Las RPC son `security invoker`: RLS y grants aplican dentro. Validan el rol al inicio para dar
-- un mensaje claro. Solo los movimientos de dinero que dispara el admin sin permiso sobre
-- `aplicaciones` (consumir saldo a favor, anular al cancelar/prorratear) son `security definer`
-- en `private`, y verifican el rol ellos mismos.

-- Corrección de la migración 4: con search_path vacío, `=` entre citext resolvía a la comparación
-- de texto (sensible a mayúsculas). Se usa el operador de citext explícito.
create or replace function private.vincular_miembros() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is not null then
    update public.miembros m
    set auth_user_id = new.id
    where m.correo operator(extensions.=) new.email::extensions.citext and m.auth_user_id is null;
  end if;
  return new;
end;
$$;

-- ---------- Movimientos internos de dinero (private, definer) ----------

-- Aplica el saldo a favor del jugador a una obligación, FIFO por fecha de pago.
create function private.aplicar_saldo_a_favor(p_obligacion_id uuid) returns numeric
language plpgsql security definer set search_path = '' as $$
declare
  v_obl public.obligaciones;
  v_falta numeric;
  v_total numeric := 0;
  v_comp record;
  v_monto numeric;
begin
  select * into v_obl from public.obligaciones where id = p_obligacion_id;
  if (select auth.uid()) is not null and not private.tiene_rol(v_obl.club_id, '{administrativo,tesorero}') then
    raise exception 'Sin permiso para aplicar saldos a favor' using errcode = '42501';
  end if;
  v_falta := v_obl.monto - v_obl.pagado;
  for v_comp in
    select c.id, c.monto - coalesce((select sum(a.monto) from public.aplicaciones a
                                     where a.comprobante_id = c.id and a.anulada_en is null), 0) as disponible
    from public.comprobantes c
    where c.miembro_id = v_obl.miembro_id and c.estado = 'aceptado'
    order by c.fecha_pago, c.created_at
  loop
    exit when v_falta <= 0;
    continue when v_comp.disponible <= 0;
    v_monto := least(v_comp.disponible, v_falta);
    insert into public.aplicaciones (club_id, comprobante_id, obligacion_id, monto, origen)
    values (v_obl.club_id, v_comp.id, v_obl.id, v_monto, 'saldo_a_favor');
    v_falta := v_falta - v_monto;
    v_total := v_total + v_monto;
  end loop;
  return v_total;
end;
$$;

-- Anula las aplicaciones activas de una obligación: el dinero vuelve al saldo a favor del jugador.
create function private.anular_aplicaciones(p_obligacion_id uuid, p_motivo text) returns numeric
language plpgsql security definer set search_path = '' as $$
declare
  v_club uuid;
  v_total numeric;
begin
  select club_id into v_club from public.obligaciones where id = p_obligacion_id;
  if (select auth.uid()) is not null and not private.tiene_rol(v_club, '{administrativo,tesorero}') then
    raise exception 'Sin permiso para anular aplicaciones' using errcode = '42501';
  end if;
  with anuladas as (
    update public.aplicaciones set anulada_en = now(), anulada_motivo = p_motivo
    where obligacion_id = p_obligacion_id and anulada_en is null
    returning monto
  )
  select coalesce(sum(monto), 0) into v_total from anuladas;
  return v_total;
end;
$$;

grant execute on function private.aplicar_saldo_a_favor(uuid), private.anular_aplicaciones(uuid, text) to authenticated;

-- ---------- RPC públicas (invoker) ----------

-- Acepta un comprobante con el desglose propuesto por el motor (o editado por el tesorero).
-- p_lineas: [{"obligacion_id": uuid, "monto": number, "regla_id": uuid|null, "manual": bool}]
-- Lo que no se asigna queda como saldo a favor (derivado).
create function public.aceptar_comprobante(p_comprobante_id uuid, p_lineas jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_comp public.comprobantes;
  l jsonb;
begin
  select * into v_comp from public.comprobantes where id = p_comprobante_id;
  if not found then
    raise exception 'Comprobante no encontrado' using errcode = 'P0002';
  end if;
  if not private.tiene_rol(v_comp.club_id, '{tesorero}') then
    raise exception 'Solo el tesorero puede aceptar comprobantes' using errcode = '42501';
  end if;
  if v_comp.estado <> 'pendiente' then
    raise exception 'Este comprobante ya fue revisado' using errcode = '23514';
  end if;

  update public.comprobantes set estado = 'aceptado' where id = p_comprobante_id;

  for l in select * from jsonb_array_elements(coalesce(p_lineas, '[]'::jsonb)) loop
    continue when coalesce((l ->> 'monto')::numeric, 0) <= 0;
    insert into public.aplicaciones (club_id, comprobante_id, obligacion_id, monto, origen, regla_id)
    values (
      v_comp.club_id, p_comprobante_id, (l ->> 'obligacion_id')::uuid, (l ->> 'monto')::numeric,
      case when (l ->> 'regla_id') is not null and not coalesce((l ->> 'manual')::boolean, false)
           then 'propuesta'::public.origen_aplicacion else 'manual'::public.origen_aplicacion end,
      case when coalesce((l ->> 'manual')::boolean, false) then null else (l ->> 'regla_id')::uuid end
    );
  end loop;
end;
$$;

-- Crea un evento y las obligaciones de su alcance; aplica saldos a favor existentes.
create function public.crear_evento(
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

  -- TODO(club): lesionados/retirados no reciben cobros nuevos (salvo selección individual).
  insert into public.obligaciones (club_id, evento_id, miembro_id, monto)
  select p_club_id, v_evento_id, m.id, p_monto
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

  for v_obl in select id from public.obligaciones where evento_id = v_evento_id loop
    perform private.aplicar_saldo_a_favor(v_obl.id);
  end loop;
  return v_evento_id;
end;
$$;

-- Cancela un evento: lo que ya se había pagado de él vuelve a cada jugador como saldo a favor.
create function public.cancelar_evento(p_evento_id uuid) returns numeric
language plpgsql security invoker set search_path = '' as $$
declare
  v_evento public.eventos_cobro;
  v_obl record;
  v_devuelto numeric := 0;
begin
  select * into v_evento from public.eventos_cobro where id = p_evento_id;
  if not found then
    raise exception 'Evento no encontrado' using errcode = 'P0002';
  end if;
  if not private.tiene_rol(v_evento.club_id, '{administrativo}') then
    raise exception 'Solo la administración cancela eventos' using errcode = '42501';
  end if;
  if v_evento.estado = 'cancelado' then
    raise exception 'El evento ya estaba cancelado' using errcode = '23514';
  end if;
  for v_obl in select id from public.obligaciones where evento_id = p_evento_id loop
    v_devuelto := v_devuelto + private.anular_aplicaciones(v_obl.id, 'Evento cancelado');
  end loop;
  update public.eventos_cobro set estado = 'cancelado', cancelado_en = now() where id = p_evento_id;
  return v_devuelto;
end;
$$;

-- TODO(club): fórmula de prorrateo no definida en los docs. Default: proporcional a los días
-- activos del mes, con un piso (el "monto mínimo que aplica independientemente de si entrenan").
create function private.prorrateo_piso() returns numeric
language sql immutable set search_path = '' as $$ select 0.5::numeric $$;

-- Cambia el estado de un jugador; al dejar de estar activo prorratea la mensualidad del mes.
create function public.cambiar_estado_miembro(p_miembro_id uuid, p_estado public.estado_miembro) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_m public.miembros;
  v_hoy date;
  v_obl record;
  v_nuevo numeric;
  v_detalle text[] := '{}';
begin
  select * into v_m from public.miembros where id = p_miembro_id;
  if not found then
    raise exception 'Jugador no encontrado' using errcode = 'P0002';
  end if;
  if not private.tiene_rol(v_m.club_id, '{administrativo}') then
    raise exception 'Solo la administración cambia el estado de un jugador' using errcode = '42501';
  end if;
  if v_m.estado = p_estado then
    return;
  end if;

  if v_m.estado = 'activo' then
    v_hoy := private.hoy(v_m.club_id);
    for v_obl in
      select o.id, o.monto, e.nombre
      from public.obligaciones o join public.eventos_cobro e on e.id = o.evento_id
      where o.miembro_id = p_miembro_id and e.estado = 'activo' and e.tipo = 'mensualidad'
        and date_trunc('month', e.fecha_limite) = date_trunc('month', v_hoy)
    loop
      v_nuevo := greatest(
        round(v_obl.monto * private.prorrateo_piso(), -2),
        round(v_obl.monto * extract(day from v_hoy)
              / extract(day from (date_trunc('month', v_hoy) + interval '1 month - 1 day')), -2)
      );
      continue when v_nuevo >= v_obl.monto;
      -- Se anula lo aplicado, se ajusta el monto y se vuelve a aplicar hasta el nuevo valor.
      perform private.anular_aplicaciones(v_obl.id, 'Prorrateo por cambio de estado');
      update public.obligaciones set monto = v_nuevo where id = v_obl.id;
      perform private.aplicar_saldo_a_favor(v_obl.id);
      v_detalle := v_detalle || format('%s: %s → %s', v_obl.nombre, private.cop(v_obl.monto), private.cop(v_nuevo));
    end loop;
  end if;

  -- El trigger de bitácora del miembro incluye el detalle del prorrateo.
  perform set_config('app.prorrateo', array_to_string(v_detalle, '; '), true);
  update public.miembros set estado = p_estado where id = p_miembro_id;
  perform set_config('app.prorrateo', '', true);
end;
$$;

-- Reordena las reglas del club en el orden dado (el FIFO debe quedar de último).
create function public.reordenar_reglas(p_club_id uuid, p_ids uuid[]) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not private.tiene_rol(p_club_id, '{tesorero}') then
    raise exception 'Solo el tesorero configura las reglas de conciliación' using errcode = '42501';
  end if;
  if (select count(*) from public.reglas_conciliacion where club_id = p_club_id) <> cardinality(p_ids) then
    raise exception 'El nuevo orden debe incluir todas las reglas del club' using errcode = '23514';
  end if;
  update public.reglas_conciliacion r set prioridad = x.pos
  from unnest(p_ids) with ordinality as x(id, pos)
  where r.id = x.id and r.club_id = p_club_id;
  perform private.registrar(p_club_id, 'regla_conciliacion_cambiada', 'regla', p_ids[1],
    format('%s reordenó las reglas de conciliación', private.actor(p_club_id)),
    jsonb_build_object('orden', to_jsonb(p_ids)));
end;
$$;

-- Agrega una regla "priorizar este evento" con la prioridad más alta.
create function public.agregar_regla_evento(p_club_id uuid, p_evento_id uuid) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_nombre text;
  v_id uuid;
begin
  if not private.tiene_rol(p_club_id, '{tesorero}') then
    raise exception 'Solo el tesorero configura las reglas de conciliación' using errcode = '42501';
  end if;
  select nombre into v_nombre from public.eventos_cobro
  where id = p_evento_id and club_id = p_club_id and estado = 'activo';
  if not found then
    raise exception 'Evento no encontrado' using errcode = 'P0002';
  end if;
  update public.reglas_conciliacion set prioridad = prioridad + 1 where club_id = p_club_id;
  insert into public.reglas_conciliacion (club_id, nombre, tipo, parametros, prioridad)
  values (p_club_id, format('Priorizar "%s"', v_nombre), 'evento_especifico',
          jsonb_build_object('evento_id', p_evento_id), 1)
  returning id into v_id;
  return v_id;
end;
$$;

-- Guarda (o corrige) la conciliación del mes. `total_aceptado` y `diferencia` los calcula la base.
create function public.guardar_conciliacion(
  p_club_id uuid, p_mes date, p_saldo_inicial numeric, p_saldo_final numeric, p_notas text default null
) returns public.conciliaciones
language plpgsql security invoker set search_path = '' as $$
declare
  v_row public.conciliaciones;
begin
  if not private.tiene_rol(p_club_id, '{tesorero}') then
    raise exception 'Solo el tesorero guarda conciliaciones' using errcode = '42501';
  end if;
  insert into public.conciliaciones (club_id, mes, saldo_inicial, saldo_final, notas)
  values (p_club_id, date_trunc('month', p_mes)::date, p_saldo_inicial, p_saldo_final, nullif(trim(p_notas), ''))
  on conflict (club_id, mes) do update
    set saldo_inicial = excluded.saldo_inicial, saldo_final = excluded.saldo_final, notas = excluded.notas
  returning * into v_row;
  return v_row;
end;
$$;

grant execute on function
  public.aceptar_comprobante(uuid, jsonb),
  public.crear_evento(uuid, text, public.tipo_cobro, numeric, date, public.alcance_cobro, text, uuid[]),
  public.cancelar_evento(uuid),
  public.cambiar_estado_miembro(uuid, public.estado_miembro),
  public.reordenar_reglas(uuid, uuid[]),
  public.agregar_regla_evento(uuid, uuid),
  public.guardar_conciliacion(uuid, date, numeric, numeric, text)
to authenticated;
grant execute on function private.prorrateo_piso(), private.cop(numeric), private.actor(uuid),
  private.nombre_miembro(uuid) to authenticated;

-- ---------- Vistas (security_invoker: respetan RLS; un jugador solo ve su fila) ----------

create view public.estado_cuenta_miembros with (security_invoker = true) as
select
  m.id as miembro_id,
  m.club_id,
  coalesce(d.total_pendiente, 0)::numeric(14, 2) as total_pendiente,
  coalesce(d.total_vencido, 0)::numeric(14, 2) as total_vencido,
  d.proximo_vencimiento,
  coalesce(s.saldo_a_favor, 0)::numeric(14, 2) as saldo_a_favor,
  case
    when coalesce(d.total_vencido, 0) > 0 then 'mora'
    when coalesce(d.total_pendiente, 0) > 0 then 'pendiente'
    else 'al_dia'
  end as estado_cuenta
from public.miembros m
cross join lateral (select private.hoy(m.club_id) as hoy) h
left join lateral (
  select
    sum(o.monto - o.pagado) as total_pendiente,
    sum(o.monto - o.pagado) filter (where e.fecha_limite < h.hoy) as total_vencido,
    min(e.fecha_limite) filter (where e.fecha_limite >= h.hoy) as proximo_vencimiento
  from public.obligaciones o
  join public.eventos_cobro e on e.id = o.evento_id
  where o.miembro_id = m.id and e.estado = 'activo' and o.pagado < o.monto
) d on true
left join lateral (
  select sum(c.monto - coalesce((select sum(a.monto) from public.aplicaciones a
                                  where a.comprobante_id = c.id and a.anulada_en is null), 0)) as saldo_a_favor
  from public.comprobantes c
  where c.miembro_id = m.id and c.estado = 'aceptado'
) s on true
where 'jugador' = any (m.roles);

-- Para tesorería/administración (un jugador solo vería su propia obligación).
create view public.progreso_eventos with (security_invoker = true) as
select
  e.id as evento_id,
  e.club_id,
  count(o.id)::int as total,
  (count(o.id) filter (where o.pagado >= o.monto))::int as pagadas,
  coalesce(sum(o.pagado), 0)::numeric(14, 2) as recaudado,
  coalesce(sum(o.monto), 0)::numeric(14, 2) as monto_total
from public.eventos_cobro e
left join public.obligaciones o on o.evento_id = e.id
group by e.id, e.club_id;

revoke all on public.estado_cuenta_miembros, public.progreso_eventos from anon;
grant select on public.estado_cuenta_miembros, public.progreso_eventos to authenticated;
