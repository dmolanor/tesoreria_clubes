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
  v_hoy date; v_fecha date; v_esperado numeric;
  n int; v numeric; ok int := 0;
begin
  insert into public.clubes (id, nombre, categorias) values (club_a, 'Club A', '{Élite}');
  insert into public.miembros (club_id, nombre, correo, categoria, roles) values
    (club_a, 'Jugador', 'jug@s.test', 'Élite', '{jugador}'), (club_a, 'Jugador 2', 'jug2@s.test', 'Élite', '{jugador}'),
    (club_a, 'Tes', 'tes@s.test', null, '{tesorero}'), (club_a, 'Adm', 'adm@s.test', null, '{administrativo}');
  insert into auth.users (id, email) values (u_jug, 'jug@s.test'), (u_jug2, 'jug2@s.test'), (u_tes, 'tes@s.test'), (u_adm, 'adm@s.test');
  select id into m_jug from public.miembros where auth_user_id = u_jug;
  select id into m_jug2 from public.miembros where auth_user_id = u_jug2;

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
  assert v < 100000 and v >= 50000, format('mensualidad prorrateada con piso del 50%%, quedó %s', v);
  -- Sin fecha efectiva se comporta como antes: prorratea con private.hoy del club.
  v_hoy := private.hoy(club_a);
  v_esperado := least(100000, greatest(round(100000 * 0.5, -2),
    round(100000 * extract(day from v_hoy)
          / extract(day from (date_trunc('month', v_hoy) + interval '1 month - 1 day')), -2)));
  assert v = v_esperado, format('sin fecha efectiva prorratea con hoy: esperado %s, quedó %s', v_esperado, v);
  select saldo_a_favor into v from public.estado_cuenta_miembros where miembro_id = m_jug;
  assert v > 0, 'el exceso pagado queda como saldo a favor';
  select count(*) into n from public.bitacora where tipo = 'jugador_estado_cambiado' and descripcion like '%prorrateo%';
  assert n = 1, 'la bitácora explica el prorrateo';
  ok := ok + 4;
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
  v_esperado := greatest(round(100000 * 0.5, -2),
    round(100000 * 21 / extract(day from (date_trunc('month', v_fecha) + interval '1 month - 1 day')), -2));
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
