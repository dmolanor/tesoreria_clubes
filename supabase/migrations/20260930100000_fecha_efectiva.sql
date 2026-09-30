-- Fecha efectiva al cambiar el estado de un jugador.
-- La administración registra el cambio cuando se entera (el 30), pero la lesión pudo ser el 21:
-- el prorrateo usa la fecha real del evento, no la del registro.

-- Se elimina la firma vieja para no dejar dos sobrecargas: con el parámetro nuevo en `default null`,
-- una llamada con dos argumentos sería ambigua entre ambas.
drop function public.cambiar_estado_miembro(uuid, public.estado_miembro);

-- Cambia el estado de un jugador; al dejar de estar activo prorratea la mensualidad del mes de la
-- fecha efectiva (por defecto, hoy en la zona horaria del club).
--
-- Reglas de la fecha efectiva:
-- * No puede ser futura (mayor que private.hoy del club): se rechaza con check_violation.
-- * Escoge el mes: se prorratea la mensualidad activa cuya fecha límite cae en el mes de la fecha
--   efectiva, y los días del prorrateo son los de ese mes (día de la fecha / días del mes, con piso).
-- * Si ese mes ya pasó y la mensualidad estaba pagada completa, el prorrateo igual reduce el monto:
--   se anulan las aplicaciones de la obligación, se ajusta el monto y se vuelve a aplicar el saldo a
--   favor hasta el nuevo valor. El excedente queda como saldo a favor del jugador y se consume en
--   el próximo cobro (anular_aplicaciones + aplicar_saldo_a_favor, igual que en el mes en curso).
-- * Entre estados no activos (lesionado ↔ retirado) o hacia activo, la fecha se acepta y queda en
--   la bitácora, pero no prorratea nada.
create function public.cambiar_estado_miembro(
  p_miembro_id uuid, p_estado public.estado_miembro, p_fecha_efectiva date default null
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_m public.miembros;
  v_hoy date;
  v_fecha date;
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

  if v_m.estado = 'activo' then
    for v_obl in
      select o.id, o.monto, e.nombre
      from public.obligaciones o join public.eventos_cobro e on e.id = o.evento_id
      where o.miembro_id = p_miembro_id and e.estado = 'activo' and e.tipo = 'mensualidad'
        and date_trunc('month', e.fecha_limite) = date_trunc('month', v_fecha)
    loop
      v_nuevo := greatest(
        round(v_obl.monto * private.prorrateo_piso(), -2),
        round(v_obl.monto * extract(day from v_fecha)
              / extract(day from (date_trunc('month', v_fecha) + interval '1 month - 1 day')), -2)
      );
      continue when v_nuevo >= v_obl.monto;
      -- Se anula lo aplicado, se ajusta el monto y se vuelve a aplicar hasta el nuevo valor.
      perform private.anular_aplicaciones(v_obl.id, 'Prorrateo por cambio de estado');
      update public.obligaciones set monto = v_nuevo where id = v_obl.id;
      perform private.aplicar_saldo_a_favor(v_obl.id);
      v_detalle := v_detalle || format('%s: %s → %s', v_obl.nombre, private.cop(v_obl.monto), private.cop(v_nuevo));
    end loop;
  end if;

  -- El trigger de bitácora del miembro incluye la fecha efectiva y el detalle del prorrateo.
  perform set_config('app.prorrateo', array_to_string(v_detalle, '; '), true);
  perform set_config('app.fecha_efectiva', v_fecha::text, true);
  update public.miembros set estado = p_estado where id = p_miembro_id;
  perform set_config('app.prorrateo', '', true);
  perform set_config('app.fecha_efectiva', '', true);
end;
$$;

revoke execute on function public.cambiar_estado_miembro(uuid, public.estado_miembro, date) from public, anon;
grant execute on function public.cambiar_estado_miembro(uuid, public.estado_miembro, date) to authenticated;

-- Bitácora del miembro: misma firma y mismos eventos; ahora muestra la fecha efectiva cuando el
-- cambio de estado viene de cambiar_estado_miembro. Un update directo sigue saliendo como antes.
create or replace function private.miembros_bitacora() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_fecha date;
begin
  if tg_op = 'INSERT' and 'jugador' = any (new.roles) then
    perform private.registrar(new.club_id, 'jugador_creado', 'miembro', new.id,
      format('%s agregó a %s (%s)', private.actor(new.club_id), new.nombre, coalesce(new.categoria, 'sin categoría')),
      jsonb_build_object('correo', new.correo));
  elsif tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    v_fecha := nullif(current_setting('app.fecha_efectiva', true), '')::date;
    perform private.registrar(new.club_id, 'jugador_estado_cambiado', 'miembro', new.id,
      format('%s cambió a %s de %s a %s%s%s', private.actor(new.club_id), new.nombre, old.estado, new.estado,
             coalesce(' desde el ' || to_char(v_fecha, 'DD/MM/YYYY'), ''),
             coalesce(' (prorrateo: ' || nullif(current_setting('app.prorrateo', true), '') || ')', '')),
      jsonb_build_object('anterior', old.estado, 'nuevo', new.estado)
        || case when v_fecha is null then '{}'::jsonb else jsonb_build_object('fecha_efectiva', v_fecha) end);
  end if;
  return null;
end;
$$;
