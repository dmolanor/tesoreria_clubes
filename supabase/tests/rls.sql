-- Pruebas de RLS, grants e invariantes. No deja rastro: todo ocurre en un bloque que termina con
-- `raise exception 'RLS_OK …'`, lo que revierte la transacción. Cualquier otro error = prueba fallida.
-- Ejecutar como postgres (MCP execute_sql o psql). El mensaje final resume las pruebas pasadas.

do $pruebas$
declare
  club_a uuid := gen_random_uuid();
  club_b uuid := gen_random_uuid();
  u_tes uuid := gen_random_uuid();   -- tesorera + jugadora en A
  u_adm uuid := gen_random_uuid();   -- administrador en A
  u_jug uuid := gen_random_uuid();   -- jugador en A
  u_jug2 uuid := gen_random_uuid();  -- otro jugador en A
  u_tesb uuid := gen_random_uuid();  -- tesorero en B
  m_tes uuid; m_adm uuid; m_jug uuid; m_jug2 uuid; m_tesb uuid;
  v_evento uuid; v_torneo uuid; v_obl uuid; v_comp uuid; v_comp2 uuid; v_comp_b uuid;
  v_acuerdo uuid;
  n int;
  v numeric;
  ok int := 0;
begin
  -- ---------- Datos (como postgres) ----------
  insert into public.clubes (id, nombre, categorias) values (club_a, 'Club A', '{Élite,Junior}'), (club_b, 'Club B', '{Open}');
  insert into public.miembros (club_id, nombre, correo, categoria, roles) values
    (club_a, 'Tesorera', 'Tes@A.test', 'Élite', '{tesorero,jugador}'),
    (club_a, 'Admin', 'adm@a.test', null, '{administrativo}'),
    (club_a, 'Jugador', 'jug@a.test', 'Élite', '{jugador}'),
    (club_a, 'Jugador 2', 'jug2@a.test', 'Junior', '{jugador}'),
    (club_b, 'Tesorero B', 'tes@b.test', 'Open', '{tesorero,jugador,administrativo}');
  -- El trigger de auth.users vincula por correo (sin distinguir mayúsculas).
  insert into auth.users (id, email) values
    (u_tes, 'tes@a.test'), (u_adm, 'adm@a.test'), (u_jug, 'jug@a.test'), (u_jug2, 'jug2@a.test'), (u_tesb, 'tes@b.test');
  select id into m_tes from public.miembros where auth_user_id = u_tes;
  select id into m_adm from public.miembros where auth_user_id = u_adm;
  select id into m_jug from public.miembros where auth_user_id = u_jug;
  select id into m_jug2 from public.miembros where auth_user_id = u_jug2;
  select id into m_tesb from public.miembros where auth_user_id = u_tesb;
  assert m_tes is not null and m_jug2 is not null and m_tesb is not null, 'vínculo auth.users → miembros por correo';
  ok := ok + 1;
  insert into public.reglas_conciliacion (club_id, nombre, tipo, prioridad) values
    (club_a, 'Monto exacto', 'monto_exacto', 1), (club_a, 'Más antiguo primero', 'mas_antiguo_primero', 2);

  -- ---------- anon: no ve nada ----------
  execute 'set local role anon';
  begin
    perform count(*) from public.miembros;
    raise exception 'NO_FALLO anon lee miembros';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  execute 'reset role';

  -- ---------- admin A: crea eventos (RPC) ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_adm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_evento := public.crear_evento(club_a, 'Mensualidad', 'mensualidad', 100000, current_date - 5, 'todos');
  v_torneo := public.crear_evento(club_a, 'Torneo', 'torneo', 150000, current_date + 20, 'grupo', 'Élite');
  select count(*) into n from public.obligaciones where evento_id = v_evento;
  assert n = 3, format('mensualidad para 3 jugadores activos, hubo %s', n);  -- tesorera, jug, jug2
  select count(*) into n from public.obligaciones where evento_id = v_torneo;
  assert n = 2, 'torneo solo para Élite';
  ok := ok + 2;
  select count(*) into n from public.bitacora where tipo = 'evento_cobro_creado';
  assert n = 2, 'bitácora registra la creación';
  select count(*) into n from public.bitacora where actor_id = m_adm;
  assert n = 2, 'bitácora registra al admin como actor';
  ok := ok + 2;
  -- admin no configura reglas
  begin
    update public.reglas_conciliacion set activa = false where tipo = 'monto_exacto';
    get diagnostics n = row_count;
    assert n = 0, 'NO_FALLO admin desactivó una regla';
    ok := ok + 1;
  end;
  -- admin no toca `pagado`
  begin
    update public.obligaciones set pagado = 1 where evento_id = v_evento;
    raise exception 'NO_FALLO admin cambió pagado';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  execute 'reset role';

  -- ---------- jugador A ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_jug, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.obligaciones;
  assert n = 2, format('el jugador ve solo sus 2 deudas, vio %s', n);
  select count(*) into n from public.miembros;
  assert n = 1, 'el jugador solo se ve a sí mismo';
  select count(*) into n from public.bitacora;
  assert n = 0, 'el jugador no ve la bitácora';
  select count(*) into n from public.reglas_conciliacion;
  assert n = 0, 'el jugador no ve las reglas';
  select total_pendiente into v from public.estado_cuenta_miembros;
  assert v = 250000, format('vista: debe 250.000, dice %s', v);
  select count(*) into n from public.estado_cuenta_miembros;
  assert n = 1, 'vista: el jugador solo ve su fila';
  ok := ok + 6;
  -- sube un comprobante propio
  insert into public.comprobantes (club_id, miembro_id, monto, fecha_pago) values (club_a, m_jug, 150000, current_date)
  returning id into v_comp;
  ok := ok + 1;
  -- no puede subirlo ya aceptado (sin grant sobre `estado`)
  begin
    insert into public.comprobantes (club_id, miembro_id, monto, estado) values (club_a, m_jug, 1000, 'aceptado');
    raise exception 'NO_FALLO jugador insertó un comprobante aceptado';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  -- ni a nombre de otro
  begin
    insert into public.comprobantes (club_id, miembro_id, monto) values (club_a, m_jug2, 1000);
    raise exception 'NO_FALLO jugador subió a nombre de otro';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  -- ni aceptarlo
  begin
    perform public.aceptar_comprobante(v_comp, '[]');
    raise exception 'NO_FALLO jugador aceptó';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  execute 'reset role';

  -- jugador 2 sube uno (para probar rechazo y aislamiento)
  perform set_config('request.jwt.claims', json_build_object('sub', u_jug2, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.comprobantes (club_id, miembro_id, monto) values (club_a, m_jug2, 50000) returning id into v_comp2;
  select count(*) into n from public.comprobantes;
  assert n = 1, 'jugador 2 no ve el comprobante del jugador 1';
  ok := ok + 1;
  execute 'reset role';

  -- ---------- tesorera A ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_tes, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.comprobantes where estado = 'pendiente';
  assert n = 2, 'la tesorera ve la bandeja del club';
  ok := ok + 1;
  -- acepta con el torneo (150.000 exacto)
  select id into v_obl from public.obligaciones where evento_id = v_torneo and miembro_id = m_jug;
  perform public.aceptar_comprobante(v_comp, jsonb_build_array(jsonb_build_object('obligacion_id', v_obl, 'monto', 150000,
    'regla_id', (select id from public.reglas_conciliacion where tipo = 'monto_exacto'))));
  select estado into strict v from (select case when o.estado = 'pagado' then 1 else 0 end as estado from public.obligaciones o where o.id = v_obl) x;
  assert v = 1, 'el torneo queda pagado';
  select revisado_por into strict v_obl from public.comprobantes where id = v_comp;
  assert v_obl = m_tes, 'revisado_por = la tesorera (lo fija el trigger)';
  ok := ok + 2;
  -- no se re-revisa
  begin
    update public.comprobantes set estado = 'rechazado', motivo_rechazo = 'x' where id = v_comp;
    raise exception 'NO_FALLO re-revisión';
  exception when check_violation then ok := ok + 1;
  end;
  -- rechazar exige motivo
  begin
    update public.comprobantes set estado = 'rechazado' where id = v_comp2;
    raise exception 'NO_FALLO rechazo sin motivo';
  exception when check_violation then ok := ok + 1;
  end;
  update public.comprobantes set estado = 'rechazado', motivo_rechazo = 'Imagen ilegible' where id = v_comp2;
  ok := ok + 1;
  -- una línea no puede exceder lo que se debe
  insert into public.comprobantes (club_id, miembro_id, monto) values (club_a, m_tes, 300000) returning id into v_comp;
  select id into v_obl from public.obligaciones where evento_id = v_evento and miembro_id = m_tes;
  begin
    perform public.aceptar_comprobante(v_comp, jsonb_build_array(jsonb_build_object('obligacion_id', v_obl, 'monto', 200000)));
    raise exception 'NO_FALLO aplicó más de lo que se debía';
  exception when check_violation then ok := ok + 1;
  end;
  -- sobrepago → saldo a favor derivado
  perform public.aceptar_comprobante(v_comp, jsonb_build_array(jsonb_build_object('obligacion_id', v_obl, 'monto', 100000)));
  select saldo_a_favor into v from public.estado_cuenta_miembros where miembro_id = m_tes;
  assert v = 200000, format('saldo a favor 200.000, dice %s', v);
  ok := ok + 1;
  -- la bitácora es inmutable
  begin
    update public.bitacora set descripcion = 'x';
    raise exception 'NO_FALLO tesorera editó la bitácora';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  -- el FIFO no se desactiva ni deja de ser último
  begin
    update public.reglas_conciliacion set activa = false where tipo = 'mas_antiguo_primero';
    raise exception 'NO_FALLO FIFO desactivado';
  exception when check_violation then ok := ok + 1;
  end;
  -- aislamiento entre clubes
  select count(*) into n from public.comprobantes where club_id = club_b;
  assert n = 0, 'la tesorera de A no ve B';
  ok := ok + 1;
  execute 'reset role';

  -- ---------- admin A: saldo a favor, cancelación y prorrateo ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_adm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_evento := public.crear_evento(club_a, 'Uniforme', 'uniforme', 80000, current_date + 30, 'individual', null, array[m_tes]);
  select pagado into v from public.obligaciones where evento_id = v_evento;
  assert v = 80000, 'crear_evento consume el saldo a favor';
  select saldo_a_favor into v from public.estado_cuenta_miembros where miembro_id = m_tes;
  assert v = 120000, 'queda 120.000 a favor';
  perform public.cancelar_evento(v_evento);
  select saldo_a_favor into v from public.estado_cuenta_miembros where miembro_id = m_tes;
  assert v = 200000, 'cancelar devuelve el saldo a favor';
  select count(*) into n from public.bitacora where tipo = 'evento_cobro_cancelado';
  assert n = 1, 'bitácora registra la cancelación';
  ok := ok + 4;
  -- nunca dejar el club sin admin
  begin
    update public.miembros set roles = '{jugador}' where id = m_adm;
    raise exception 'NO_FALLO club sin admin';
  exception when check_violation then ok := ok + 1;
  end;
  -- FK compuesta: no mezclar clubes
  begin
    insert into public.obligaciones (club_id, evento_id, miembro_id, monto) values (club_a, v_torneo, m_tesb, 1);
    raise exception 'NO_FALLO obligación cruzada entre clubes';
  exception when foreign_key_violation then ok := ok + 1;
  end;
  execute 'reset role';

  -- ---------- acuerdos de pago ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_tes, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select o.id into v_obl from public.obligaciones o
  join public.eventos_cobro e on e.id = o.evento_id
  where e.nombre = 'Mensualidad' and o.miembro_id = m_jug2;
  insert into public.acuerdos_pago (club_id, miembro_id, obligacion_id, notas, evidencia_path)
  values (club_a, m_jug2, v_obl, 'Paga en dos partes', format('%s/acuerdos/e1.jpg', club_a)) returning id into v_acuerdo;
  insert into public.cuotas_acuerdo (club_id, acuerdo_id, numero, fecha, monto) values
    (club_a, v_acuerdo, 1, current_date + 7, 50000),
    (club_a, v_acuerdo, 2, current_date + 14, 50000);
  select count(*) into n from public.bitacora where tipo = 'acuerdo_pago_cambiado';
  assert n = 1, 'bitácora registra el acuerdo';
  ok := ok + 2;
  -- el acuerdo y la deuda son del mismo jugador
  begin
    insert into public.acuerdos_pago (club_id, miembro_id, obligacion_id, evidencia_path)
    values (club_a, m_jug, v_obl, format('%s/acuerdos/e2.jpg', club_a));
    raise exception 'NO_FALLO acuerdo con jugador distinto al de la deuda';
  exception when check_violation then ok := ok + 1;
  end;
  -- una sola deuda, un solo acuerdo activo
  begin
    insert into public.acuerdos_pago (club_id, miembro_id, obligacion_id, evidencia_path)
    values (club_a, m_jug2, v_obl, format('%s/acuerdos/e3.jpg', club_a));
    raise exception 'NO_FALLO segundo acuerdo activo sobre la misma deuda';
  exception when unique_violation then ok := ok + 1;
  end;
  execute 'reset role';

  -- jugador 2 ve el suyo; jugador 1 no ve nada y no puede crear
  perform set_config('request.jwt.claims', json_build_object('sub', u_jug2, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.acuerdos_pago;
  assert n = 1, 'el jugador ve su propio acuerdo';
  select count(*) into n from public.cuotas_acuerdo;
  assert n = 2, 'el jugador ve sus cuotas';
  ok := ok + 2;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', u_jug, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.acuerdos_pago;
  assert n = 0, 'un jugador no ve acuerdos ajenos';
  -- Sobre su propia deuda, para que la validación de jugador/deuda no se adelante a RLS.
  begin
    insert into public.acuerdos_pago (club_id, miembro_id, obligacion_id, evidencia_path)
    select club_a, m_jug, o.id, format('%s/acuerdos/e4.jpg', club_a) from public.obligaciones o
    join public.eventos_cobro e on e.id = o.evento_id
    where e.nombre = 'Mensualidad' and o.miembro_id = m_jug;
    raise exception 'NO_FALLO jugador creó un acuerdo';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    insert into public.cuotas_acuerdo (club_id, acuerdo_id, numero, fecha, monto) values (club_a, v_acuerdo, 3, current_date, 1000);
    raise exception 'NO_FALLO jugador agregó una cuota';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  ok := ok + 1;  -- el assert de aislamiento
  execute 'reset role';

  -- administración lee pero no crea
  perform set_config('request.jwt.claims', json_build_object('sub', u_adm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.acuerdos_pago;
  assert n = 1, 'administración ve los acuerdos del club';
  begin
    insert into public.acuerdos_pago (club_id, miembro_id, obligacion_id, evidencia_path)
    values (club_a, m_jug2, v_obl, format('%s/acuerdos/e5.jpg', club_a));
    raise exception 'NO_FALLO administración creó un acuerdo';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  ok := ok + 1;
  execute 'reset role';

  -- cancelar libera la deuda para un acuerdo nuevo
  perform set_config('request.jwt.claims', json_build_object('sub', u_tes, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.acuerdos_pago set estado = 'cancelado' where id = v_acuerdo;
  insert into public.acuerdos_pago (club_id, miembro_id, obligacion_id, evidencia_path)
  values (club_a, m_jug2, v_obl, format('%s/acuerdos/e6.jpg', club_a)) returning id into v_acuerdo;
  select count(*) into n from public.acuerdos_pago where obligacion_id = v_obl and estado = 'activo';
  assert n = 1, 'tras cancelar queda un solo acuerdo activo';
  ok := ok + 2;
  execute 'reset role';

  -- ---------- club B no ve A; cambio de rol aplica de inmediato ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_tesb, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.miembros where club_id = club_a;
  assert n = 0, 'B no ve miembros de A';
  select count(*) into n from public.bitacora where club_id = club_a;
  assert n = 0, 'B no ve la bitácora de A';
  ok := ok + 2;
  execute 'reset role';

  update public.miembros set roles = '{jugador}' where id = m_tes;  -- (como postgres) quitarle tesorería
  perform set_config('request.jwt.claims', json_build_object('sub', u_tes, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.comprobantes;
  assert n = 1, format('sin rol de tesorera solo ve su comprobante, vio %s', n);
  ok := ok + 1;
  execute 'reset role';

  -- ---------- recordatorios ----------
  update public.miembros set roles = '{tesorero,jugador}' where id = m_tes;  -- devolverle tesorería
  perform set_config('request.jwt.claims', json_build_object('sub', u_tes, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.reglas_recordatorio (club_id, nombre, tipo, dia_mes) values (club_a, 'Mensualidad día 5', 'mensual', 5)
  returning id into v_comp;
  update public.reglas_recordatorio set activa = false where id = v_comp;
  delete from public.reglas_recordatorio where id = v_comp;
  ok := ok + 1;
  begin
    insert into public.reglas_recordatorio (club_id, nombre, tipo, dias_antes) values (club_a, 'x', 'mensual', 3);
    raise exception 'NO_FALLO regla mensual con dias_antes';
  exception when check_violation then ok := ok + 1;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', u_jug, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    insert into public.reglas_recordatorio (club_id, nombre, tipo) values (club_a, 'x', 'acuerdo_pago');
    raise exception 'NO_FALLO jugador creó un recordatorio';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', u_adm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    insert into public.reglas_recordatorio (club_id, nombre, tipo) values (club_a, 'x', 'acuerdo_pago');
    raise exception 'NO_FALLO administración creó un recordatorio';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  execute 'reset role';

  raise exception 'RLS_OK % pruebas pasaron', ok;
end
$pruebas$;

-- Storage y prorrateo (segundo bloque, mismo patrón).
do $pruebas_storage$
declare
  club_a uuid := gen_random_uuid();
  u_jug uuid := gen_random_uuid(); u_jug2 uuid := gen_random_uuid(); u_tes uuid := gen_random_uuid(); u_adm uuid := gen_random_uuid();
  m_jug uuid; m_jug2 uuid;
  v_evento uuid; v_comp uuid;
  v_hoy date; v_fecha date; v_esperado numeric; v_dias_mes numeric; v_r numeric;
  n int; v numeric; ok int := 0;
begin
  insert into public.clubes (id, nombre, categorias) values (club_a, 'Club A', '{Élite}');
  insert into public.miembros (club_id, nombre, correo, categoria, roles) values
    (club_a, 'Jugador', 'jug@s.test', 'Élite', '{jugador}'), (club_a, 'Jugador 2', 'jug2@s.test', 'Élite', '{jugador}'),
    (club_a, 'Tes', 'tes@s.test', null, '{tesorero}'), (club_a, 'Adm', 'adm@s.test', null, '{administrativo}');
  insert into auth.users (id, email) values (u_jug, 'jug@s.test'), (u_jug2, 'jug2@s.test'), (u_tes, 'tes@s.test'), (u_adm, 'adm@s.test');
  select id into m_jug from public.miembros where auth_user_id = u_jug;
  select id into m_jug2 from public.miembros where auth_user_id = u_jug2;
  -- Tarifa de lesionado del club: el prorrateo nuevo la exige antes de cambiar a ese estado.
  insert into public.tarifas_estado (club_id, estado, monto_mensual) values (club_a, 'lesionado', 40000);

  -- Storage: el jugador sube a su carpeta; no a la de otro; otro jugador no lo ve; tesorería sí.
  perform set_config('request.jwt.claims', json_build_object('sub', u_jug, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into storage.objects (bucket_id, name) values ('comprobantes', format('%s/%s/a.jpg', club_a, m_jug));
  ok := ok + 1;
  begin
    insert into storage.objects (bucket_id, name) values ('comprobantes', format('%s/%s/b.jpg', club_a, m_jug2));
    raise exception 'NO_FALLO subió a la carpeta de otro';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', u_jug2, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from storage.objects where bucket_id = 'comprobantes';
  assert n = 0, 'otro jugador no ve el archivo';
  ok := ok + 1;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', u_tes, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from storage.objects where bucket_id = 'comprobantes';
  assert n = 1, 'tesorería ve el archivo del club';
  ok := ok + 1;
  execute 'reset role';

  -- Prorrateo: mensualidad del mes pagada completa; al pasar a lesionado se ajusta y el exceso queda a favor.
  perform set_config('request.jwt.claims', json_build_object('sub', u_adm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_evento := public.crear_evento(club_a, 'Mensualidad', 'mensualidad', 100000, date_trunc('month', current_date)::date + 9, 'todos');
  execute 'reset role';
  insert into public.comprobantes (club_id, miembro_id, monto, estado, revisado_en) values (club_a, m_jug, 100000, 'aceptado', now())
  returning id into v_comp;
  insert into public.aplicaciones (club_id, comprobante_id, obligacion_id, monto, origen)
  select club_a, v_comp, o.id, 100000, 'manual' from public.obligaciones o where o.evento_id = v_evento and o.miembro_id = m_jug;
  perform set_config('request.jwt.claims', json_build_object('sub', u_adm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.cambiar_estado_miembro(m_jug, 'lesionado');
  select o.monto into v from public.obligaciones o where o.evento_id = v_evento and o.miembro_id = m_jug;
  -- Sin fecha efectiva se comporta igual: prorratea con private.hoy del club.
  -- Fórmula incremental: nuevo = monto − tarifa(activo)·r + tarifa(lesionado)·r, r = días que quedan / días del mes.
  v_hoy := private.hoy(club_a);
  v_dias_mes := extract(day from (date_trunc('month', v_hoy) + interval '1 month - 1 day'));
  v_r := (v_dias_mes - extract(day from v_hoy) + 1) / v_dias_mes;
  v_esperado := round(100000 - 100000 * v_r + 40000 * v_r, -2);
  assert v = v_esperado, format('prorrateo incremental sin fecha efectiva: esperado %s, quedó %s', v_esperado, v);
  select saldo_a_favor into v from public.estado_cuenta_miembros where miembro_id = m_jug;
  assert v > 0, 'el exceso pagado queda como saldo a favor';
  select count(*) into n from public.bitacora where tipo = 'jugador_estado_cambiado' and descripcion like '%prorrateo%';
  assert n = 1, 'la bitácora explica el prorrateo';
  ok := ok + 3;
  execute 'reset role';

  -- Fecha efectiva: lesión el día 21 del mes pasado, registrada hoy, con esa mensualidad ya pagada.
  v_fecha := (date_trunc('month', v_hoy) - interval '1 month')::date + 20;
  perform set_config('request.jwt.claims', json_build_object('sub', u_adm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_evento := public.crear_evento(club_a, 'Mensualidad pasada', 'mensualidad', 100000, v_fecha - 10, 'todos');
  execute 'reset role';
  insert into public.comprobantes (club_id, miembro_id, monto, estado, revisado_en) values (club_a, m_jug2, 100000, 'aceptado', now())
  returning id into v_comp;
  insert into public.aplicaciones (club_id, comprobante_id, obligacion_id, monto, origen)
  select club_a, v_comp, o.id, 100000, 'manual' from public.obligaciones o where o.evento_id = v_evento and o.miembro_id = m_jug2;
  perform set_config('request.jwt.claims', json_build_object('sub', u_adm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  -- una fecha futura se rechaza y no cambia nada
  begin
    perform public.cambiar_estado_miembro(m_jug2, 'lesionado', v_hoy + 1);
    raise exception 'NO_FALLO aceptó una fecha efectiva futura';
  exception when check_violation then ok := ok + 1;
  end;
  select count(*) into n from public.miembros where id = m_jug2 and estado = 'activo';
  assert n = 1, 'la fecha futura no cambió el estado';
  ok := ok + 1;
  perform public.cambiar_estado_miembro(m_jug2, 'lesionado', v_fecha);
  v_dias_mes := extract(day from (date_trunc('month', v_fecha) + interval '1 month - 1 day'));
  v_r := (v_dias_mes - extract(day from v_fecha) + 1) / v_dias_mes;
  v_esperado := round(100000 - 100000 * v_r + 40000 * v_r, -2);
  select o.monto into v from public.obligaciones o where o.evento_id = v_evento and o.miembro_id = m_jug2;
  assert v = v_esperado, format('prorrateo al día 21 del mes de la fecha efectiva: esperado %s, quedó %s', v_esperado, v);
  select saldo_a_favor into v from public.estado_cuenta_miembros where miembro_id = m_jug2;
  assert v = 100000 - v_esperado, format('mes pasado ya pagado: el excedente queda a favor (%s), dice %s', 100000 - v_esperado, v);
  select count(*) into n from public.bitacora
  where tipo = 'jugador_estado_cambiado' and objetivo_id = m_jug2
    and descripcion like '%desde el ' || to_char(v_fecha, 'DD/MM/YYYY') || '%'
    and metadata->>'fecha_efectiva' = v_fecha::text;
  assert n = 1, 'la bitácora muestra la fecha efectiva';
  ok := ok + 3;
  execute 'reset role';

  raise exception 'STORAGE_Y_PRORRATEO_OK % pruebas pasaron', ok;
end
$pruebas_storage$;

-- Egresos y cuadre (tercer bloque, mismo patrón).
do $pruebas_egresos$
declare
  club_a uuid := gen_random_uuid();
  club_b uuid := gen_random_uuid();
  u_tes uuid := gen_random_uuid(); u_adm uuid := gen_random_uuid(); u_jug uuid := gen_random_uuid(); u_tesb uuid := gen_random_uuid();
  m_jug uuid;
  v_egreso uuid; v_egreso_b uuid;
  v_evento uuid; v_evento_b uuid;
  v_mes date := date_trunc('month', current_date)::date;
  n int; v numeric; ok int := 0;
begin
  insert into public.clubes (id, nombre, categorias) values (club_a, 'Club A', '{Élite}'), (club_b, 'Club B', '{Open}');
  insert into public.miembros (club_id, nombre, correo, categoria, roles) values
    (club_a, 'Tes', 'tes@e.test', null, '{tesorero}'), (club_a, 'Adm', 'adm@e.test', null, '{administrativo}'),
    (club_a, 'Jugador', 'jug@e.test', 'Élite', '{jugador}'), (club_b, 'Tes B', 'tesb@e.test', 'Open', '{tesorero,administrativo}');
  insert into auth.users (id, email) values (u_tes, 'tes@e.test'), (u_adm, 'adm@e.test'), (u_jug, 'jug@e.test'), (u_tesb, 'tesb@e.test');
  select id into m_jug from public.miembros where auth_user_id = u_jug;
  -- Un ingreso aceptado del mes (como postgres) para probar el cuadre.
  insert into public.comprobantes (club_id, miembro_id, monto, fecha_pago, estado, revisado_en)
  values (club_a, m_jug, 500000, v_mes, 'aceptado', now());
  -- Un evento por club, para probar que un egreso no sustenta el cobro de otro club.
  insert into public.eventos_cobro (club_id, nombre, tipo, monto, fecha_limite, alcance) values
    (club_a, 'Torneo Regional', 'torneo', 100000, v_mes + 10, 'individual') returning id into v_evento;
  insert into public.eventos_cobro (club_id, nombre, tipo, monto, fecha_limite, alcance) values
    (club_b, 'Evento B', 'otro', 1000, v_mes + 10, 'individual') returning id into v_evento_b;

  -- ---------- tesorera A: registra y anula ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_tes, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.egresos (club_id, fecha, monto, concepto, categoria) values
    (club_a, v_mes, 300000, 'Arriendo de cancha', 'canchas') returning id into v_egreso;
  insert into public.egresos (club_id, fecha, monto, concepto, categoria, categoria_otro) values (club_a, v_mes, 50000, 'Duplicado', 'otros', 'Varios');
  select count(*) into n from public.egresos e where e.creado_por = (select id from public.miembros where auth_user_id = u_tes);
  assert n = 2, 'creado_por = la tesorera (lo fija el trigger)';
  select count(*) into n from public.bitacora where tipo = 'egreso_registrado' and club_id = club_a and descripcion like '%$300.000%';
  assert n = 1, 'bitácora registra el egreso con el monto formateado';
  ok := ok + 3;
  update public.egresos set anulado_en = now() where concepto = 'Duplicado';
  select count(*) into n from public.bitacora where tipo = 'egreso_anulado' and club_id = club_a;
  assert n = 1, 'bitácora registra la anulación';
  ok := ok + 1;
  -- no se re-anula ni se edita el monto
  begin
    update public.egresos set anulado_en = now() where concepto = 'Duplicado';
    raise exception 'NO_FALLO re-anulación';
  exception when check_violation then ok := ok + 1;
  end;
  begin
    update public.egresos set monto = 1 where id = v_egreso;
    raise exception 'NO_FALLO tesorera editó el monto';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    delete from public.egresos where id = v_egreso;
    raise exception 'NO_FALLO tesorera borró un egreso';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  -- no a nombre de otro club
  begin
    insert into public.egresos (club_id, fecha, monto, concepto, categoria) values (club_b, v_mes, 1000, 'x', 'canchas');
    raise exception 'NO_FALLO egreso en otro club';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  -- ni con fecha futura
  begin
    insert into public.egresos (club_id, fecha, monto, concepto, categoria) values (club_a, current_date + 40, 1000, 'x', 'canchas');
    raise exception 'NO_FALLO egreso futuro';
  exception when check_violation then ok := ok + 1;
  end;
  -- Storage: sube el soporte a la carpeta de egresos del club
  insert into storage.objects (bucket_id, name) values ('comprobantes', format('%s/egresos/f.pdf', club_a));
  ok := ok + 1;
  -- Cuadre: 500.000 aceptados − 300.000 de egresos (el anulado no cuenta) = 200.000 esperados
  perform public.guardar_conciliacion(club_a, v_mes, 1000000, 1200000);
  select total_egresos into v from public.conciliaciones where club_id = club_a;
  assert v = 300000, format('total_egresos 300.000 (sin el anulado), dice %s', v);
  select diferencia into v from public.conciliaciones where club_id = club_a;
  assert v = 0, format('cuadra: 1.200.000 − 1.000.000 − (500.000 − 300.000) = 0, dice %s', v);
  ok := ok + 2;
  execute 'reset role';

  -- ---------- admin A: también registra y anula egresos ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_adm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.egresos;
  assert n = 2, format('admin lee los egresos del club, vio %s', n);
  ok := ok + 1;
  insert into public.egresos (club_id, fecha, monto, concepto, categoria, evento_id) values
    (club_a, v_mes, 90000, 'Observadores del torneo', 'torneos', v_evento) returning id into v_egreso;
  select count(*) into n from public.egresos e
  where e.id = v_egreso and e.evento_id = v_evento and e.creado_por = (select id from public.miembros where auth_user_id = u_adm);
  assert n = 1, 'el admin registra un egreso que sustenta un evento, creado_por = el admin';
  ok := ok + 2;
  update public.egresos set anulado_en = now() where id = v_egreso;
  select count(*) into n from public.egresos where id = v_egreso and anulado_en is not null;
  assert n = 1, 'el admin anula su propio egreso';
  ok := ok + 1;
  -- 'otros' sin texto se rechaza
  begin
    insert into public.egresos (club_id, fecha, monto, concepto, categoria) values (club_a, v_mes, 1000, 'x', 'otros');
    raise exception 'NO_FALLO otros sin categoria_otro';
  exception when check_violation then ok := ok + 1;
  end;
  -- un evento de otro club no sustenta un egreso de este
  begin
    insert into public.egresos (club_id, fecha, monto, concepto, categoria, evento_id) values (club_a, v_mes, 1000, 'x', 'canchas', v_evento_b);
    raise exception 'NO_FALLO evento de otro club';
  exception when foreign_key_violation then ok := ok + 1;
  end;
  insert into storage.objects (bucket_id, name) values ('comprobantes', format('%s/egresos/g.pdf', club_a));
  ok := ok + 1; -- el admin también sube soportes
  execute 'reset role';

  -- ---------- jugador A: no ve ni registra ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_jug, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.egresos;
  assert n = 0, 'el jugador no ve egresos';
  select count(*) into n from storage.objects where bucket_id = 'comprobantes';
  assert n = 0, 'el jugador no ve los soportes';
  ok := ok + 2;
  begin
    insert into public.egresos (club_id, fecha, monto, concepto, categoria) values (club_a, v_mes, 1000, 'x', 'canchas');
    raise exception 'NO_FALLO jugador registró un egreso';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('comprobantes', format('%s/egresos/h.pdf', club_a));
    raise exception 'NO_FALLO jugador subió un soporte de egreso';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  execute 'reset role';

  -- ---------- club B: aislamiento ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_tesb, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.egresos (club_id, fecha, monto, concepto, categoria) values (club_b, v_mes, 70000, 'Discos', 'uniformes') returning id into v_egreso_b;
  select count(*) into n from public.egresos;
  assert n = 1, format('B solo ve su egreso, vio %s', n);
  update public.egresos set anulado_en = now() where id = v_egreso;
  get diagnostics n = row_count;
  assert n = 0, 'B no anula egresos de A';
  ok := ok + 2;
  begin
    insert into storage.objects (bucket_id, name) values ('comprobantes', format('%s/egresos/i.pdf', club_a));
    raise exception 'NO_FALLO B subió a la carpeta de A';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  execute 'reset role';

  raise exception 'EGRESOS_OK % pruebas pasaron', ok;
end
$pruebas_egresos$;

-- Estados con tarifas, "inactivo", bloqueo de retiro y condonación (cuarto bloque, mismo patrón).
do $pruebas_estados$
declare
  club_a uuid := gen_random_uuid();
  u_adm uuid := gen_random_uuid(); u_tes uuid := gen_random_uuid();
  u_jug uuid := gen_random_uuid(); u_jug2 uuid := gen_random_uuid(); u_jug3 uuid := gen_random_uuid(); u_jug4 uuid := gen_random_uuid();
  m_adm uuid; m_tes uuid; m_jug uuid; m_jug2 uuid; m_jug3 uuid; m_jug4 uuid;
  v_evento1 uuid; v_evento2 uuid; v_evento3 uuid; v_obl_jug2 uuid; v_comp uuid;
  v_dias_mes numeric; v_r numeric; v_esperado numeric; v_antes numeric;
  n int; v numeric; ok int := 0;
begin
  insert into public.clubes (id, nombre, categorias) values (club_a, 'Club A', '{Élite}');
  insert into public.miembros (club_id, nombre, correo, categoria, roles) values
    (club_a, 'Adm', 'adm@t.test', null, '{administrativo}'), (club_a, 'Tes', 'tes@t.test', null, '{tesorero}'),
    (club_a, 'Jugador', 'jug@t.test', 'Élite', '{jugador}');
  insert into auth.users (id, email) values (u_adm, 'adm@t.test'), (u_tes, 'tes@t.test'), (u_jug, 'jug@t.test');
  select id into m_adm from public.miembros where auth_user_id = u_adm;
  select id into m_tes from public.miembros where auth_user_id = u_tes;
  select id into m_jug from public.miembros where auth_user_id = u_jug;

  -- Mensualidad de un mes pasado de 30 días (abril), independiente de "hoy".
  perform set_config('request.jwt.claims', json_build_object('sub', u_adm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_evento1 := public.crear_evento(club_a, 'Mensualidad abril', 'mensualidad', 160000, '2020-04-10', 'todos');

  -- Sin tarifa configurada: el cambio de estado se rechaza con un mensaje claro.
  begin
    perform public.cambiar_estado_miembro(m_jug, 'lesionado', '2020-04-16');
    raise exception 'NO_FALLO cambió a lesionado sin tarifa configurada';
  exception when check_violation then ok := ok + 1;
  end;
  execute 'reset role';

  insert into public.tarifas_estado (club_id, estado, monto_mensual) values
    (club_a, 'lesionado', 40000), (club_a, 'inactivo', 60000);

  perform set_config('request.jwt.claims', json_build_object('sub', u_adm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  -- 160.000 → lesionado el día 16 de un mes de 30 días: 160000 − 160000·(15/30) + 40000·(15/30) = 100.000.
  perform public.cambiar_estado_miembro(m_jug, 'lesionado', '2020-04-16');
  select o.monto into v from public.obligaciones o where o.evento_id = v_evento1 and o.miembro_id = m_jug;
  assert v = 100000, format('160.000 → lesionado día 16/30 debía quedar en 100.000, quedó %s', v);
  ok := ok + 1;

  -- Dos cambios en el mismo mes: lesionado → inactivo el día 21.
  v_dias_mes := 30;
  v_r := (v_dias_mes - 21 + 1) / v_dias_mes;
  v_esperado := round(v - 40000 * v_r + 60000 * v_r, -2);
  perform public.cambiar_estado_miembro(m_jug, 'inactivo', '2020-04-21');
  select o.monto into v from public.obligaciones o where o.evento_id = v_evento1 and o.miembro_id = m_jug;
  assert v = v_esperado, format('lesionado → inactivo el día 21: esperado %s, quedó %s', v_esperado, v);
  ok := ok + 1;

  -- Vuelta a activo: sube el monto (tarifa de activo = monto del evento, 160.000).
  v_antes := v;
  v_r := (v_dias_mes - 25 + 1) / v_dias_mes;
  v_esperado := round(v_antes - 60000 * v_r + 160000 * v_r, -2);
  perform public.cambiar_estado_miembro(m_jug, 'activo', '2020-04-25');
  select o.monto into v from public.obligaciones o where o.evento_id = v_evento1 and o.miembro_id = m_jug;
  assert v = v_esperado and v > v_antes, format('inactivo → activo el día 25: esperado %s (> %s), quedó %s', v_esperado, v_antes, v);
  ok := ok + 1;

  -- Jugadores para el bloqueo de retiro (como postgres, igual que el resto de datos del bloque).
  execute 'reset role';
  insert into public.miembros (club_id, nombre, correo, categoria, roles) values
    (club_a, 'Jugador 2', 'jug2@t.test', 'Élite', '{jugador}'), (club_a, 'Jugador 3', 'jug3@t.test', 'Élite', '{jugador}');
  insert into auth.users (id, email) values (u_jug2, 'jug2@t.test'), (u_jug3, 'jug3@t.test');
  select id into m_jug2 from public.miembros where auth_user_id = u_jug2;
  select id into m_jug3 from public.miembros where auth_user_id = u_jug3;

  -- Torneo (no mensualidad): el prorrateo por cambio de estado no lo toca, así que la deuda
  -- queda intacta para probar el bloqueo de retiro sin que el propio prorrateo la borre.
  perform set_config('request.jwt.claims', json_build_object('sub', u_adm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_evento2 := public.crear_evento(club_a, 'Torneo', 'torneo', 50000, current_date + 10, 'todos');
  select id into v_obl_jug2 from public.obligaciones where evento_id = v_evento2 and miembro_id = m_jug2;
  execute 'reset role';

  -- jug3 queda con saldo a favor (paga 70.000 contra una deuda de 50.000).
  insert into public.comprobantes (club_id, miembro_id, monto, estado, revisado_en) values (club_a, m_jug3, 70000, 'aceptado', now())
  returning id into v_comp;
  insert into public.aplicaciones (club_id, comprobante_id, obligacion_id, monto, origen)
  select club_a, v_comp, o.id, 50000, 'manual' from public.obligaciones o where o.evento_id = v_evento2 and o.miembro_id = m_jug3;

  perform set_config('request.jwt.claims', json_build_object('sub', u_adm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  -- Retiro bloqueado: jug2 debe 50.000.
  begin
    perform public.cambiar_estado_miembro(m_jug2, 'retirado');
    raise exception 'NO_FALLO retiró a alguien con deuda';
  exception when check_violation then ok := ok + 1;
  end;
  -- Retiro bloqueado: jug3 tiene 20.000 a favor.
  begin
    perform public.cambiar_estado_miembro(m_jug3, 'retirado');
    raise exception 'NO_FALLO retiró a alguien con saldo a favor';
  exception when check_violation then ok := ok + 1;
  end;
  -- El admin no condona (solo tesorería).
  begin
    perform public.condonar_obligacion(v_obl_jug2, 'Se retira del club');
    raise exception 'NO_FALLO el admin condonó una obligación';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  execute 'reset role';

  -- La tesorería condona la deuda de jug2 y el retiro queda permitido.
  perform set_config('request.jwt.claims', json_build_object('sub', u_tes, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.condonar_obligacion(v_obl_jug2, 'Se retira del club');
  select monto into v from public.obligaciones where id = v_obl_jug2;
  assert v = 0, format('condonar deja monto = pagado (0), quedó %s', v);
  select count(*) into n from public.bitacora
  where tipo = 'obligacion_condonada' and objetivo_id = v_obl_jug2 and metadata->>'motivo' = 'Se retira del club';
  assert n = 1, 'la bitácora registra la condonación con el motivo';
  ok := ok + 2;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_adm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.cambiar_estado_miembro(m_jug2, 'retirado');
  select count(*) into n from public.miembros where id = m_jug2 and estado = 'retirado';
  assert n = 1, 'retiro permitido tras condonar la deuda';
  ok := ok + 1;

  -- crear_evento de mensualidad también cobra a los lesionados, a su tarifa.
  execute 'reset role';
  insert into public.miembros (club_id, nombre, correo, categoria, roles) values (club_a, 'Jugador 4', 'jug4@t.test', 'Élite', '{jugador}');
  insert into auth.users (id, email) values (u_jug4, 'jug4@t.test');
  select id into m_jug4 from public.miembros where auth_user_id = u_jug4;

  perform set_config('request.jwt.claims', json_build_object('sub', u_adm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.cambiar_estado_miembro(m_jug4, 'lesionado');
  v_evento3 := public.crear_evento(club_a, 'Mensualidad nueva', 'mensualidad', 90000, current_date + 5, 'todos');
  select count(*) into n from public.obligaciones where evento_id = v_evento3;
  assert n = 3, format('mensualidad para activos + lesionados con tarifa (jug, jug3, jug4), hubo %s', n);
  select monto into v from public.obligaciones where evento_id = v_evento3 and miembro_id = m_jug4;
  assert v = 40000, format('el lesionado paga su tarifa (40.000), quedó %s', v);
  ok := ok + 2;
  execute 'reset role';

  -- El jugador no configura tarifas.
  perform set_config('request.jwt.claims', json_build_object('sub', u_jug, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    insert into public.tarifas_estado (club_id, estado, monto_mensual) values (club_a, 'lesionado', 1);
    raise exception 'NO_FALLO el jugador insertó una tarifa';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  update public.tarifas_estado set monto_mensual = 1 where club_id = club_a;
  get diagnostics n = row_count;
  assert n = 0, 'NO_FALLO el jugador editó una tarifa';
  ok := ok + 1;
  execute 'reset role';

  raise exception 'ESTADOS_OK % pruebas pasaron', ok;
end
$pruebas_estados$;

do $pruebas_tareas$
declare
  club_a uuid := gen_random_uuid();
  club_b uuid := gen_random_uuid();
  u_adm uuid := gen_random_uuid(); u_tes uuid := gen_random_uuid();
  u_jug1 uuid := gen_random_uuid(); u_jug2 uuid := gen_random_uuid(); u_jug3 uuid := gen_random_uuid();
  u_tesb uuid := gen_random_uuid();
  m_adm uuid; m_tes uuid; m_jug1 uuid; m_jug2 uuid; m_jug3 uuid;
  v_tarea uuid;
  n int; ok int := 0;
begin
  insert into public.clubes (id, nombre, categorias) values (club_a, 'Club A', '{Élite,Junior}'), (club_b, 'Club B', '{Open}');
  insert into public.miembros (club_id, nombre, correo, categoria, roles) values
    (club_a, 'Admin', 'adm@t.test', null, '{administrativo}'),
    (club_a, 'Tesorera', 'tes@t.test', null, '{tesorero}'),
    (club_a, 'Jugador 1', 'jug1@t.test', 'Élite', '{jugador}'),
    (club_a, 'Jugador 2', 'jug2@t.test', 'Élite', '{jugador}'),
    (club_a, 'Jugador 3', 'jug3@t.test', 'Junior', '{jugador}'),
    (club_b, 'Tesorero B', 'tesb@t.test', 'Open', '{tesorero,administrativo,jugador}');
  insert into auth.users (id, email) values
    (u_adm, 'adm@t.test'), (u_tes, 'tes@t.test'), (u_jug1, 'jug1@t.test'), (u_jug2, 'jug2@t.test'),
    (u_jug3, 'jug3@t.test'), (u_tesb, 'tesb@t.test');
  select id into m_adm from public.miembros where auth_user_id = u_adm;
  select id into m_tes from public.miembros where auth_user_id = u_tes;
  select id into m_jug1 from public.miembros where auth_user_id = u_jug1;
  select id into m_jug2 from public.miembros where auth_user_id = u_jug2;
  select id into m_jug3 from public.miembros where auth_user_id = u_jug3;

  -- ---------- admin A: crea una tarea de grupo (RPC) ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_adm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_tarea := public.crear_tarea(club_a, 'Entrega de uniformes', 'https://tally.so/f', current_date + 10, 'grupo', 'Élite');
  select count(*) into n from public.tareas_miembros where tarea_id = v_tarea;
  assert n = 2, format('solo los 2 jugadores Élite activos, hubo %s', n);  -- jug1, jug2
  select count(*) into n from public.bitacora where tipo = 'tarea_creada' and club_id = club_a and actor_id = m_adm;
  assert n = 1, 'bitácora registra la creación con el admin como actor';
  ok := ok + 2;
  -- link sin https se rechaza
  begin
    perform public.crear_tarea(club_a, 'Tarea mala', 'http://sin-https.test', current_date + 10, 'todos');
    raise exception 'NO_FALLO link sin https';
  exception when check_violation then ok := ok + 1;
  end;
  execute 'reset role';

  -- ---------- jugador 1 A: ve solo la suya y la marca ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_jug1, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.tareas; assert n = 1, format('ve solo la tarea asignada, vio %s', n);
  select count(*) into n from public.tareas_miembros; assert n = 1, format('ve solo su fila, vio %s', n);
  ok := ok + 2;
  update public.tareas_miembros set completada_en = now() where tarea_id = v_tarea and miembro_id = m_jug1;
  get diagnostics n = row_count;
  assert n = 1, 'el jugador marca su propia tarea';
  select count(*) into n from public.tareas_miembros where tarea_id = v_tarea and miembro_id = m_jug1 and completada_en is not null;
  assert n = 1, 'completada_en queda guardada';
  ok := ok + 1;
  -- no puede marcar la de otro
  update public.tareas_miembros set completada_en = now() where tarea_id = v_tarea and miembro_id = m_jug2;
  get diagnostics n = row_count;
  assert n = 0, 'NO_FALLO jugador 1 marcó la tarea de jugador 2';
  ok := ok + 1;
  -- el jugador no crea tareas
  begin
    perform public.crear_tarea(club_a, 'Tarea de jugador', 'https://x.test', current_date + 5, 'todos');
    raise exception 'NO_FALLO jugador creó una tarea';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    insert into public.tareas (club_id, nombre, link, fecha_limite, alcance) values (club_a, 'x', 'https://x.test', current_date, 'todos');
    raise exception 'NO_FALLO jugador insertó en tareas directamente';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  execute 'reset role';

  -- ---------- jugador 3 A: no le asignaron nada ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_jug3, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.tareas; assert n = 0, 'jugador 3 (Junior) no ve la tarea de Élite';
  ok := ok + 1;
  execute 'reset role';

  -- ---------- tesorería A: lee pero no crea ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_tes, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.tareas; assert n = 1, format('tesorería ve la tarea del club, vio %s', n);
  ok := ok + 1;
  begin
    perform public.crear_tarea(club_a, 'Tarea de tesorería', 'https://x.test', current_date + 5, 'todos');
    raise exception 'NO_FALLO tesorería creó una tarea';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    insert into public.tareas (club_id, nombre, link, fecha_limite, alcance) values (club_a, 'x', 'https://x.test', current_date, 'todos');
    raise exception 'NO_FALLO tesorería insertó en tareas directamente';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  execute 'reset role';

  -- ---------- admin A: cancela la tarea ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_adm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.cancelar_tarea(v_tarea);
  select count(*) into n from public.tareas where id = v_tarea and estado = 'cancelada';
  assert n = 1, 'la tarea queda cancelada';
  select count(*) into n from public.bitacora where tipo = 'tarea_cancelada' and club_id = club_a;
  assert n = 1, 'bitácora registra la cancelación';
  ok := ok + 2;
  begin
    perform public.cancelar_tarea(v_tarea);
    raise exception 'NO_FALLO recancelar una tarea';
  exception when check_violation then ok := ok + 1;
  end;
  execute 'reset role';

  -- ---------- club B: aislamiento ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_tesb, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.tareas; assert n = 0, 'B no ve las tareas de A';
  select count(*) into n from public.tareas_miembros; assert n = 0, 'B no ve las asignaciones de A';
  ok := ok + 2;
  begin
    perform public.cancelar_tarea(v_tarea);  -- tarea de A: RLS la vuelve invisible para B, aunque B también es administrativo
    raise exception 'NO_FALLO administrador de B canceló una tarea de A';
  exception when no_data_found then ok := ok + 1;
  end;
  update public.tareas_miembros set completada_en = now() where tarea_id = v_tarea and miembro_id = m_jug2;
  get diagnostics n = row_count;
  assert n = 0, 'NO_FALLO B marcó una asignación de A';
  ok := ok + 1;
  execute 'reset role';

  raise exception 'TAREAS_OK % pruebas pasaron', ok;
end
$pruebas_tareas$;


-- Cruces de cuentas (cuarto bloque, mismo patrón): un jugador que trabaja para el club.
do $pruebas_cruces$
declare
  club_a uuid := gen_random_uuid();
  u_tes uuid := gen_random_uuid(); u_adm uuid := gen_random_uuid(); u_jug uuid := gen_random_uuid();
  m_jug uuid;
  v_evento uuid; v_obl uuid; v_comp uuid; v_egreso uuid;
  v_canal public.canal_comprobante;
  v_hoy date; v_mes date;
  n int; v numeric; v_pagado numeric; ok int := 0;
begin
  insert into public.clubes (id, nombre, categorias) values (club_a, 'Club A', '{Élite}');
  insert into public.miembros (club_id, nombre, correo, categoria, roles) values
    (club_a, 'Tes', 'tes@cr.test', null, '{tesorero}'),
    (club_a, 'Adm', 'adm@cr.test', null, '{administrativo}'),
    (club_a, 'Jugador', 'jug@cr.test', 'Élite', '{jugador}');
  insert into auth.users (id, email) values (u_tes, 'tes@cr.test'), (u_adm, 'adm@cr.test'), (u_jug, 'jug@cr.test');
  select id into m_jug from public.miembros where auth_user_id = u_jug;
  -- "Hoy" según la zona horaria del club (no `current_date`, que puede ir un día adelante de
  -- `private.hoy` en la ventana UTC 00:00–05:00 — mismo cuidado que el bloque de prorrateo).
  v_hoy := private.hoy(club_a);
  v_mes := date_trunc('month', v_hoy)::date;

  -- Mensualidad pendiente del jugador: el cruce la cubre con la propuesta del motor (nunca FIFO a mano).
  perform set_config('request.jwt.claims', json_build_object('sub', u_adm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_evento := public.crear_evento(club_a, 'Mensualidad', 'mensualidad', 60000, v_hoy + 10, 'todos');
  execute 'reset role';
  select o.id into v_obl from public.obligaciones o where o.evento_id = v_evento and o.miembro_id = m_jug;

  -- ---------- solo tesorería registra cruces ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_adm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    perform public.registrar_cruce(m_jug, 60000, v_hoy, 'Entrenamiento',
      jsonb_build_array(jsonb_build_object('obligacion_id', v_obl, 'monto', 60000)));
    raise exception 'NO_FALLO administración registró un cruce';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', u_jug, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    perform public.registrar_cruce(m_jug, 60000, v_hoy, 'Entrenamiento',
      jsonb_build_array(jsonb_build_object('obligacion_id', v_obl, 'monto', 60000)));
    raise exception 'NO_FALLO el jugador registró su propio cruce';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  execute 'reset role';

  -- ---------- tesorera: registra el cruce ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_tes, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_comp := public.registrar_cruce(m_jug, 60000, v_hoy, 'Entrenamiento septiembre',
    jsonb_build_array(jsonb_build_object('obligacion_id', v_obl, 'monto', 60000)));
  ok := ok + 1;
  -- el comprobante queda aceptado, con canal 'compensacion', y la obligación pagada
  select canal into v_canal from public.comprobantes where id = v_comp and estado = 'aceptado';
  assert v_canal = 'compensacion', 'el comprobante del cruce queda aceptado con canal compensacion';
  select pagado, monto into v_pagado, v from public.obligaciones where id = v_obl;
  assert v_pagado = 60000 and v_pagado = v, format('la obligación queda pagada: pagado=%s monto=%s', v_pagado, v);
  ok := ok + 2;
  -- bitácora: una sola entrada específica, sin duplicar la genérica de comprobante/egreso
  select count(*) into n from public.bitacora
  where tipo = 'cruce_registrado' and club_id = club_a and descripcion like '%Jugador%' and descripcion like '%$60.000%';
  assert n = 1, 'bitácora registra el cruce con el jugador y el monto';
  select count(*) into n from public.bitacora
  where club_id = club_a and tipo in ('comprobante_subido', 'comprobante_aceptado', 'egreso_registrado');
  assert n = 0, 'el cruce no deja bitácora genérica duplicada';
  ok := ok + 2;

  -- ---------- un egreso de cruce no se anula suelto ----------
  select id into v_egreso from public.egresos where comprobante_id = v_comp;
  begin
    update public.egresos set anulado_en = now() where id = v_egreso;
    raise exception 'NO_FALLO anuló un egreso de cruce suelto';
  exception when check_violation then ok := ok + 1;
  end;
  execute 'reset role';

  -- ---------- el cruce no cambia la diferencia de una conciliación ----------
  -- Ingreso y egreso reales del mes, para que el cuadre tenga algo que cuadrar además del cruce.
  insert into public.comprobantes (club_id, miembro_id, monto, fecha_pago, estado, revisado_en)
  values (club_a, m_jug, 40000, v_mes, 'aceptado', now());
  insert into public.egresos (club_id, fecha, monto, concepto, categoria) values (club_a, v_mes, 20000, 'Discos de juego', 'uniformes');
  perform public.guardar_conciliacion(club_a, v_mes, 1000000, 1020000);
  select total_aceptado into v from public.conciliaciones where club_id = club_a;
  assert v = 40000, format('total_aceptado excluye la compensación del cruce (40.000), dice %s', v);
  select total_egresos into v from public.conciliaciones where club_id = club_a;
  assert v = 20000, format('total_egresos excluye el egreso del cruce (20.000), dice %s', v);
  select diferencia into v from public.conciliaciones where club_id = club_a;
  assert v = 0, format('el cruce se anula a sí mismo frente al banco: esperado 20.000 = banco 20.000, dice %s de diferencia', v);
  ok := ok + 3;

  raise exception 'CRUCES_OK % pruebas pasaron', ok;
end
$pruebas_cruces$;


-- Evidencia de acuerdos de pago (cuarto bloque, mismo patrón).
do $pruebas_evidencia$
declare
  club_a uuid := gen_random_uuid();
  u_tes uuid := gen_random_uuid(); u_adm uuid := gen_random_uuid(); u_jug uuid := gen_random_uuid();
  m_jug uuid;
  v_evento uuid; v_obl uuid;
  n int; ok int := 0;
begin
  insert into public.clubes (id, nombre, categorias) values (club_a, 'Club A', '{Élite}');
  insert into public.miembros (club_id, nombre, correo, categoria, roles) values
    (club_a, 'Tes', 'tes@v.test', null, '{tesorero}'), (club_a, 'Adm', 'adm@v.test', null, '{administrativo}'),
    (club_a, 'Jugador', 'jug@v.test', 'Élite', '{jugador}');
  insert into auth.users (id, email) values (u_tes, 'tes@v.test'), (u_adm, 'adm@v.test'), (u_jug, 'jug@v.test');
  select id into m_jug from public.miembros where auth_user_id = u_jug;

  perform set_config('request.jwt.claims', json_build_object('sub', u_adm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_evento := public.crear_evento(club_a, 'Mensualidad', 'mensualidad', 100000, current_date + 10, 'todos');
  execute 'reset role';
  select id into v_obl from public.obligaciones where evento_id = v_evento and miembro_id = m_jug;

  -- ---------- tesorería: sin evidencia no hay acuerdo; la ruta debe ser la del club ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_tes, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    insert into public.acuerdos_pago (club_id, miembro_id, obligacion_id) values (club_a, m_jug, v_obl);
    raise exception 'NO_FALLO acuerdo sin evidencia';
  exception when not_null_violation then ok := ok + 1;
  end;
  begin
    insert into public.acuerdos_pago (club_id, miembro_id, obligacion_id, evidencia_path)
    values (club_a, m_jug, v_obl, 'otro-club/acuerdos/x.jpg');
    raise exception 'NO_FALLO evidencia fuera de la carpeta del club';
  exception when check_violation then ok := ok + 1;
  end;

  -- Storage: tesorería sube la evidencia a la carpeta de acuerdos del club.
  insert into storage.objects (bucket_id, name) values ('comprobantes', format('%s/acuerdos/x.jpg', club_a));
  ok := ok + 1;
  -- con evidencia en Storage, el acuerdo queda registrado
  insert into public.acuerdos_pago (club_id, miembro_id, obligacion_id, evidencia_path)
  values (club_a, m_jug, v_obl, format('%s/acuerdos/x.jpg', club_a));
  select count(*) into n from public.acuerdos_pago;
  assert n = 1, 'el acuerdo con evidencia válida queda registrado';
  ok := ok + 1;
  execute 'reset role';

  -- ---------- el jugador no sube evidencia ni la lee ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_jug, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    insert into storage.objects (bucket_id, name) values ('comprobantes', format('%s/acuerdos/y.jpg', club_a));
    raise exception 'NO_FALLO jugador subió evidencia de un acuerdo';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  select count(*) into n from storage.objects where bucket_id = 'comprobantes' and name like format('%s/acuerdos/%%', club_a);
  assert n = 0, 'el jugador no lee la evidencia del acuerdo';
  ok := ok + 1;
  execute 'reset role';

  -- ---------- el admin sí la lee (misma política de club que los soportes de egresos) ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_adm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from storage.objects where bucket_id = 'comprobantes' and name like format('%s/acuerdos/%%', club_a);
  assert n = 1, 'el admin lee la evidencia del acuerdo';
  ok := ok + 1;
  execute 'reset role';

  raise exception 'EVIDENCIA_OK % pruebas pasaron', ok;
end
$pruebas_evidencia$;
