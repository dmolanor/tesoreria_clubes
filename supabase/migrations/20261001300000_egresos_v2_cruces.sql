-- Egresos v2: categorías reales del club, administración también registra y anula egresos,
-- un egreso puede sustentarse en un evento de cobro, y el cruce de cuentas para jugadores que
-- trabajan para el club (ej. entrenan a cambio de un pago) — un comprobante de compensación y
-- un egreso de nómina que se anulan entre sí frente al banco, sin pasar plata real.

-- ---------- Categorías: las que el club realmente usa ----------
-- Mapeo 1:1 (mismo oid, solo cambia la etiqueta): arriendo_cancha→canchas, arbitros→torneos,
-- equipamiento→uniformes, federacion→liga_federacion, otro→otros. El default de la columna
-- (`'otro'`) queda apuntando al mismo oid, así que pasa a mostrarse como 'otros' sin tocarlo.
alter type public.categoria_egreso rename value 'arriendo_cancha' to 'canchas';
alter type public.categoria_egreso rename value 'arbitros' to 'torneos';
alter type public.categoria_egreso rename value 'equipamiento' to 'uniformes';
alter type public.categoria_egreso rename value 'federacion' to 'liga_federacion';
alter type public.categoria_egreso rename value 'otro' to 'otros';
alter type public.categoria_egreso add value if not exists 'nomina';
alter type public.categoria_egreso add value if not exists 'administrativos';
alter type public.categoria_egreso add value if not exists 'polizas';

-- Nuevos valores de los enums cerrados de la bitácora y del canal de comprobante (decisión
-- deliberada, ver docs/02). Solo se usan dentro de cuerpos plpgsql, así que no chocan con la
-- transacción de la migración (mismo patrón que 20260930014028_egresos.sql).
alter type public.tipo_bitacora add value if not exists 'cruce_registrado';
alter type public.canal_comprobante add value if not exists 'compensacion';

-- ---------- Columnas nuevas ----------

alter table public.egresos add column categoria_otro text;
alter table public.egresos add column evento_id uuid;
alter table public.egresos add column comprobante_id uuid;

-- 'otros' siempre trae el texto libre; las demás categorías no lo usan.
alter table public.egresos add constraint egresos_categoria_otro_check check (
  (categoria = 'otros' and length(trim(coalesce(categoria_otro, ''))) > 0)
  or (categoria <> 'otros' and categoria_otro is null)
);

-- Qué cobro sustenta el egreso (ej. un arriendo de cancha para un torneo puntual). Opcional.
alter table public.egresos add constraint egresos_club_id_evento_id_fkey
  foreign key (club_id, evento_id) references public.eventos_cobro (club_id, id);

-- Enlaza el egreso al comprobante de compensación de un cruce. Uno a uno: un comprobante
-- respalda a lo sumo un egreso.
alter table public.egresos add constraint egresos_club_id_comprobante_id_fkey
  foreign key (club_id, comprobante_id) references public.comprobantes (club_id, id);
alter table public.egresos add constraint egresos_comprobante_id_key unique (comprobante_id);

create index egresos_evento_idx on public.egresos (club_id, evento_id);

-- El jugador llena categoria_otro y evento_id; comprobante_id solo lo escribe `registrar_cruce`
-- (bypass de RLS por ser `security definer`), nunca un insert directo del cliente.
grant insert (categoria_otro, evento_id) on public.egresos to authenticated;

-- ---------- RLS: administración también registra y anula egresos ----------

drop policy "Tesorería registra egresos" on public.egresos;
create policy "Tesorería y administración registran egresos" on public.egresos for insert to authenticated
  with check (club_id = any ((select private.clubes_con_rol('{tesorero,administrativo}'))::uuid[]));

drop policy "Tesorería anula egresos" on public.egresos;
create policy "Tesorería y administración anulan egresos" on public.egresos for update to authenticated
  using (club_id = any ((select private.clubes_con_rol('{tesorero,administrativo}'))::uuid[]))
  with check (club_id = any ((select private.clubes_con_rol('{tesorero,administrativo}'))::uuid[]));

drop policy "Soportes de egresos: tesorería sube a la carpeta del club" on storage.objects;
create policy "Soportes de egresos: tesorería y administración suben a la carpeta del club"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'comprobantes'
  and (storage.foldername(name))[2] = 'egresos'
  and private.uuid_o_null((storage.foldername(name))[1]) = any ((select private.clubes_con_rol('{tesorero,administrativo}'))::uuid[])
);

-- ---------- Triggers: inmutabilidad incluye las columnas nuevas; un cruce no se anula suelto ----------

create or replace function private.egresos_validar() returns trigger
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
  if (new.club_id, new.fecha, new.monto, new.concepto, new.categoria, new.categoria_otro, new.evento_id,
      new.comprobante_id, new.soporte_path, new.creado_por) is distinct from
     (old.club_id, old.fecha, old.monto, old.concepto, old.categoria, old.categoria_otro, old.evento_id,
      old.comprobante_id, old.soporte_path, old.creado_por) then
    raise exception 'Un egreso no se edita: se anula y se registra otro' using errcode = '23514';
  end if;
  if new.anulado_en is not null then
    -- Los dos lados de un cruce se anulan entre sí frente al banco: anularlo suelto rompería ese cruce.
    if old.comprobante_id is not null then
      raise exception 'Un egreso de cruce no se anula directamente' using errcode = '23514';
    end if;
    new.anulado_en := now();  -- la hora la pone la base, no el cliente
  end if;
  return new;
end;
$$;

-- El cruce ya queda en la bitácora con 'cruce_registrado' (un solo evento de negocio); el
-- registro genérico de egreso se omite para no duplicar la entrada.
create or replace function private.egresos_bitacora() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.comprobante_id is not null then
      return null;
    end if;
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

-- Un comprobante de compensación (canal 'compensacion') tampoco deja rastro genérico de
-- "comprobante_subido/aceptado": lo cubre la misma entrada 'cruce_registrado'.
create or replace function private.comprobantes_bitacora() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_jugador text := private.nombre_miembro(new.miembro_id);
begin
  if new.canal = 'compensacion' then
    return null;
  end if;
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

-- ---------- Cuadre: compensaciones e egresos de cruce se anulan entre sí frente al banco ----------

create or replace function private.conciliaciones_calcular() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.total_aceptado := (
    select coalesce(sum(c.monto), 0) from public.comprobantes c
    where c.club_id = new.club_id and c.estado = 'aceptado' and c.canal <> 'compensacion'
      and c.fecha_pago >= new.mes and c.fecha_pago < (new.mes + interval '1 month')::date
  );
  new.total_egresos := (
    select coalesce(sum(e.monto), 0) from public.egresos e
    where e.club_id = new.club_id and e.anulado_en is null and e.comprobante_id is null
      and e.fecha >= new.mes and e.fecha < (new.mes + interval '1 month')::date
  );
  if tg_op = 'INSERT' and (select auth.uid()) is not null then
    new.creado_por := private.miembro_actual(new.club_id);
  end if;
  return new;
end;
$$;

-- ---------- Cruce de cuentas: jugadores que trabajan para el club ----------

-- Registra el cruce en una sola transacción: un comprobante de compensación (sin plata real,
-- sin archivo), aceptado con el desglose que propone el motor (misma `aceptar_comprobante` que
-- usa la bandeja), y un egreso de nómina enlazado a ese comprobante. Los dos lados se anulan
-- entre sí frente al banco (ver `conciliaciones_calcular`). `security definer` porque escribe
-- columnas que ningún grant expone al cliente (`canal`, `egresos.comprobante_id`); el rol se
-- valida aquí con `private.tiene_rol`, igual que `private.aplicar_saldo_a_favor`.
create function public.registrar_cruce(
  p_miembro_id uuid, p_monto numeric, p_fecha date, p_concepto text, p_lineas jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_club_id uuid;
  v_nombre text;
  v_comprobante_id uuid;
begin
  select club_id, nombre into v_club_id, v_nombre from public.miembros where id = p_miembro_id;
  if not found then
    raise exception 'Jugador no encontrado' using errcode = 'P0002';
  end if;
  if not private.tiene_rol(v_club_id, '{tesorero}') then
    raise exception 'Solo tesorería registra cruces' using errcode = '42501';
  end if;
  if p_monto <= 0 then
    raise exception 'El monto del cruce debe ser mayor a 0' using errcode = '23514';
  end if;
  if coalesce(trim(p_concepto), '') = '' then
    raise exception 'Escribe el concepto del cruce (ej. Entrenamiento septiembre)' using errcode = '23514';
  end if;

  insert into public.comprobantes (club_id, miembro_id, monto, fecha_pago, canal, estado)
  values (v_club_id, p_miembro_id, p_monto, p_fecha, 'compensacion', 'pendiente')
  returning id into v_comprobante_id;

  -- Misma ruta que la bandeja del tesorero: el desglose ya viene del motor de reglas (nunca FIFO a mano).
  perform public.aceptar_comprobante(v_comprobante_id, p_lineas);

  insert into public.egresos (club_id, fecha, monto, concepto, categoria, comprobante_id)
  values (v_club_id, p_fecha, p_monto, p_concepto, 'nomina', v_comprobante_id);

  perform private.registrar(v_club_id, 'cruce_registrado', 'comprobante', v_comprobante_id,
    format('%s registró un cruce de %s para %s: %s', private.actor(v_club_id), private.cop(p_monto), v_nombre, p_concepto),
    jsonb_build_object('monto', p_monto, 'miembro_id', p_miembro_id));

  return v_comprobante_id;
end;
$$;
grant execute on function public.registrar_cruce(uuid, numeric, date, text, jsonb) to authenticated;
