-- Triggers: invariantes que RLS no expresa, `obligaciones.pagado`, bitácora y vínculo con Supabase Auth.
-- Todas las funciones viven en `private` (no expuesto) con search_path vacío.

-- ---------- Utilidades ----------

-- "Hoy" en la zona horaria del club (vencimientos, prorrateo).
create function private.hoy(p_club_id uuid) returns date
language sql stable security definer set search_path = '' as $$
  select (now() at time zone c.zona_horaria)::date from public.clubes c where c.id = p_club_id
$$;
grant execute on function private.hoy(uuid) to authenticated;

-- $180.000
create function private.cop(p_monto numeric) returns text
language sql immutable set search_path = '' as $$
  select '$' || replace(to_char(round(p_monto), 'FM999,999,999,990'), ',', '.')
$$;

create function private.nombre_miembro(p_miembro_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select m.nombre from public.miembros m where m.id = p_miembro_id), 'Sistema')
$$;

-- Registra un evento de negocio. Se omite durante la carga de datos demo (`app.seed = on`),
-- que copia su propia bitácora.
create function private.registrar(
  p_club_id uuid, p_tipo public.tipo_bitacora, p_objetivo_tipo public.objetivo_bitacora,
  p_objetivo_id uuid, p_descripcion text, p_metadata jsonb default '{}'
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('app.seed', true), '') = 'on' then
    return;
  end if;
  insert into public.bitacora (club_id, tipo, actor_id, objetivo_tipo, objetivo_id, descripcion, metadata)
  values (p_club_id, p_tipo, private.miembro_actual(p_club_id), p_objetivo_tipo, p_objetivo_id, p_descripcion, p_metadata);
end;
$$;
grant execute on function private.registrar(uuid, public.tipo_bitacora, public.objetivo_bitacora, uuid, text, jsonb) to authenticated;

create function private.actor(p_club_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select private.nombre_miembro(private.miembro_actual(p_club_id))
$$;

-- Rellena `creado_por` con el miembro del usuario actual (no se puede suplantar).
create function private.set_creado_por() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null then
    new.creado_por := private.miembro_actual(new.club_id);
  end if;
  return new;
end;
$$;

-- ---------- miembros ----------

create function private.miembros_validar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.categoria is not null and not exists (
    select 1 from public.clubes c where c.id = new.club_id and new.categoria = any (c.categorias)
  ) then
    raise exception 'La categoría "%" no existe en este club', new.categoria using errcode = '23514';
  end if;

  -- Nunca dejar un club sin administración.
  if tg_op = 'UPDATE'
     and 'administrativo' = any (old.roles) and old.estado <> 'retirado'
     and (not 'administrativo' = any (new.roles) or new.estado = 'retirado')
     and not exists (
       select 1 from public.miembros m
       where m.club_id = new.club_id and m.id <> new.id and 'administrativo' = any (m.roles) and m.estado <> 'retirado'
     ) then
    raise exception 'El club debe conservar al menos un administrador' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger validar before insert or update on public.miembros
  for each row execute function private.miembros_validar();

create function private.miembros_bitacora() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and 'jugador' = any (new.roles) then
    perform private.registrar(new.club_id, 'jugador_creado', 'miembro', new.id,
      format('%s agregó a %s (%s)', private.actor(new.club_id), new.nombre, coalesce(new.categoria, 'sin categoría')),
      jsonb_build_object('correo', new.correo));
  elsif tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    perform private.registrar(new.club_id, 'jugador_estado_cambiado', 'miembro', new.id,
      format('%s cambió a %s de %s a %s%s', private.actor(new.club_id), new.nombre, old.estado, new.estado,
             coalesce(' (prorrateo: ' || nullif(current_setting('app.prorrateo', true), '') || ')', '')),
      jsonb_build_object('anterior', old.estado, 'nuevo', new.estado));
  end if;
  return null;
end;
$$;
create trigger bitacora after insert or update on public.miembros
  for each row execute function private.miembros_bitacora();

-- ---------- eventos_cobro ----------

create function private.eventos_validar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.categoria is not null and not exists (
    select 1 from public.clubes c where c.id = new.club_id and new.categoria = any (c.categorias)
  ) then
    raise exception 'La categoría "%" no existe en este club', new.categoria using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and old.estado = 'cancelado' and new.estado = 'activo' then
    raise exception 'Un evento cancelado no se reactiva: crea uno nuevo' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger validar before insert or update on public.eventos_cobro
  for each row execute function private.eventos_validar();
create trigger set_creado_por before insert on public.eventos_cobro
  for each row execute function private.set_creado_por();

create function private.eventos_bitacora() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.registrar(new.club_id, 'evento_cobro_creado', 'evento_cobro', new.id,
      format('%s creó "%s" (%s por jugador)', private.actor(new.club_id), new.nombre, private.cop(new.monto)),
      jsonb_build_object('monto', new.monto, 'alcance', new.alcance, 'categoria', new.categoria));
  elsif new.estado = 'cancelado' and old.estado <> 'cancelado' then
    perform private.registrar(new.club_id, 'evento_cobro_cancelado', 'evento_cobro', new.id,
      format('%s canceló "%s" — lo pagado pasa a saldo a favor', private.actor(new.club_id), new.nombre));
  end if;
  return null;
end;
$$;
create trigger bitacora after insert or update on public.eventos_cobro
  for each row execute function private.eventos_bitacora();

-- ---------- comprobantes ----------

create function private.comprobantes_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.estado <> 'pendiente'
     and (new.estado is distinct from old.estado or new.motivo_rechazo is distinct from old.motivo_rechazo) then
    raise exception 'Este comprobante ya fue revisado' using errcode = '23514';
  end if;
  if new.estado is distinct from old.estado then
    if new.estado = 'pendiente' then
      raise exception 'Un comprobante revisado no vuelve a pendiente' using errcode = '23514';
    end if;
    new.revisado_en := coalesce(new.revisado_en, now());
    if (select auth.uid()) is not null then
      new.revisado_en := now();
      new.revisado_por := private.miembro_actual(new.club_id);  -- no se puede suplantar al revisor
    end if;
  end if;
  return new;
end;
$$;
create trigger revision before update on public.comprobantes
  for each row execute function private.comprobantes_revision();

create function private.comprobantes_bitacora() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_jugador text := private.nombre_miembro(new.miembro_id);
begin
  if tg_op = 'INSERT' then
    perform private.registrar(new.club_id, 'comprobante_subido', 'comprobante', new.id,
      format('%s subió un comprobante de %s', v_jugador, private.cop(new.monto)),
      jsonb_build_object('monto', new.monto, 'canal', new.canal));
  elsif new.estado = 'aceptado' and old.estado = 'pendiente' then
    perform private.registrar(new.club_id, 'comprobante_aceptado', 'comprobante', new.id,
      format('%s aceptó el comprobante de %s por %s', private.actor(new.club_id), v_jugador, private.cop(new.monto)),
      jsonb_build_object('monto', new.monto));
  elsif new.estado = 'rechazado' and old.estado = 'pendiente' then
    perform private.registrar(new.club_id, 'comprobante_rechazado', 'comprobante', new.id,
      format('%s rechazó el comprobante de %s: %s', private.actor(new.club_id), v_jugador, new.motivo_rechazo),
      jsonb_build_object('monto', new.monto, 'motivo', new.motivo_rechazo));
  end if;
  return null;
end;
$$;
create trigger bitacora after insert or update on public.comprobantes
  for each row execute function private.comprobantes_bitacora();

-- ---------- aplicaciones → obligaciones.pagado ----------

create function private.aplicaciones_validar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_comp public.comprobantes;
  v_obl public.obligaciones;
  v_evento_estado public.estado_evento;
  v_aplicado numeric;
begin
  if tg_op = 'UPDATE' then
    if old.anulada_en is not null then
      raise exception 'Esta aplicación ya estaba anulada' using errcode = '23514';
    end if;
    if (new.comprobante_id, new.obligacion_id, new.monto, new.origen) is distinct from
       (old.comprobante_id, old.obligacion_id, old.monto, old.origen) then
      raise exception 'Una aplicación no se edita: se anula y se crea otra' using errcode = '23514';
    end if;
    return new;
  end if;

  if (select auth.uid()) is not null then
    new.creado_por := private.miembro_actual(new.club_id);
  end if;

  -- Bloqueos: serializa aplicaciones concurrentes sobre el mismo comprobante u obligación.
  select * into v_comp from public.comprobantes where id = new.comprobante_id for update;
  select * into v_obl from public.obligaciones where id = new.obligacion_id for update;
  select e.estado into v_evento_estado from public.eventos_cobro e where e.id = v_obl.evento_id;

  if v_comp.estado <> 'aceptado' then
    raise exception 'Solo se aplican comprobantes aceptados' using errcode = '23514';
  end if;
  if v_comp.miembro_id <> v_obl.miembro_id then
    raise exception 'El comprobante y la deuda son de jugadores distintos' using errcode = '23514';
  end if;
  if v_evento_estado <> 'activo' then
    raise exception 'No se puede aplicar a un evento cancelado' using errcode = '23514';
  end if;
  if new.monto > v_obl.monto - v_obl.pagado then
    raise exception 'Una línea aplica % a una deuda de %', private.cop(new.monto), private.cop(v_obl.monto - v_obl.pagado)
      using errcode = '23514';
  end if;
  select coalesce(sum(a.monto), 0) into v_aplicado
  from public.aplicaciones a where a.comprobante_id = new.comprobante_id and a.anulada_en is null;
  if v_aplicado + new.monto > v_comp.monto then
    raise exception 'El desglose suma %, más que el comprobante (%)', private.cop(v_aplicado + new.monto), private.cop(v_comp.monto)
      using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger validar before insert or update on public.aplicaciones
  for each row execute function private.aplicaciones_validar();

create function private.aplicaciones_recalcular_pagado() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.obligaciones o
  set pagado = (select coalesce(sum(a.monto), 0) from public.aplicaciones a
                where a.obligacion_id = o.id and a.anulada_en is null)
  where o.id = new.obligacion_id;
  return null;
end;
$$;
create trigger recalcular_pagado after insert or update on public.aplicaciones
  for each row execute function private.aplicaciones_recalcular_pagado();

-- ---------- reglas_conciliacion ----------

create trigger set_creado_por before insert on public.reglas_conciliacion
  for each row execute function private.set_creado_por();

-- El FIFO siempre va de último: es el respaldo determinístico (docs/03). Se verifica al final de la transacción.
create function private.reglas_fifo_ultima() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_club uuid := coalesce(new.club_id, old.club_id);
begin
  if exists (
    select 1 from public.reglas_conciliacion r
    where r.club_id = v_club and r.tipo = 'mas_antiguo_primero'
      and r.prioridad < (select max(x.prioridad) from public.reglas_conciliacion x where x.club_id = v_club)
  ) then
    raise exception 'La regla "más antiguo primero" siempre va de última' using errcode = '23514';
  end if;
  return null;
end;
$$;
create constraint trigger fifo_ultima after insert or update or delete on public.reglas_conciliacion
  deferrable initially deferred for each row execute function private.reglas_fifo_ultima();

-- Solo cambios con significado (activar, crear, eliminar, parámetros); los reordenamientos
-- los registra la función `reordenar_reglas` una sola vez.
create function private.reglas_bitacora() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r public.reglas_conciliacion := coalesce(new, old);
  v_accion text;
begin
  v_accion := case
    when tg_op = 'INSERT' then 'creó'
    when tg_op = 'DELETE' then 'eliminó'
    when new.activa is distinct from old.activa then case when new.activa then 'activó' else 'desactivó' end
    when new.parametros is distinct from old.parametros or new.nombre is distinct from old.nombre then 'editó'
  end;
  if v_accion is not null then
    perform private.registrar(r.club_id, 'regla_conciliacion_cambiada', 'regla', r.id,
      format('%s %s la regla "%s"', private.actor(r.club_id), v_accion, r.nombre),
      jsonb_build_object('accion', v_accion, 'tipo', r.tipo));
  end if;
  return null;
end;
$$;
create trigger bitacora after insert or update or delete on public.reglas_conciliacion
  for each row execute function private.reglas_bitacora();

-- ---------- conciliaciones ----------

-- `total_aceptado` = comprobantes aceptados cuya fecha de pago cae en el mes. Snapshot al guardar.
create function private.conciliaciones_calcular() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.total_aceptado := (
    select coalesce(sum(c.monto), 0) from public.comprobantes c
    where c.club_id = new.club_id and c.estado = 'aceptado'
      and c.fecha_pago >= new.mes and c.fecha_pago < (new.mes + interval '1 month')::date
  );
  if tg_op = 'INSERT' and (select auth.uid()) is not null then
    new.creado_por := private.miembro_actual(new.club_id);
  end if;
  return new;
end;
$$;
create trigger calcular before insert or update on public.conciliaciones
  for each row execute function private.conciliaciones_calcular();

create function private.conciliaciones_bitacora() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.registrar(new.club_id, 'conciliacion_guardada', 'conciliacion', new.id,
    format('%s guardó la conciliación de %s — diferencia %s', private.actor(new.club_id),
           to_char(new.mes, 'YYYY-MM'), private.cop(new.diferencia)),
    jsonb_build_object('total_aceptado', new.total_aceptado, 'diferencia', new.diferencia));
  return null;
end;
$$;
create trigger bitacora after insert or update on public.conciliaciones
  for each row execute function private.conciliaciones_bitacora();

-- ---------- bitácora append-only (incluso para service_role) ----------

create function private.bitacora_inmutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'La bitácora es de solo escritura: no se edita ni se borra' using errcode = '42501';
end;
$$;
create trigger inmutable before update or delete on public.bitacora
  for each row execute function private.bitacora_inmutable();

-- ---------- Vínculo con Supabase Auth ----------

-- Primer login (magic link): la cuenta se vincula a los miembros con ese correo en cualquier club.
create function private.vincular_miembros() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is not null then
    update public.miembros m
    set auth_user_id = new.id
    where m.correo = new.email::extensions.citext and m.auth_user_id is null;
  end if;
  return new;
end;
$$;
create trigger vincular_miembros after insert or update of email on auth.users
  for each row execute function private.vincular_miembros();
