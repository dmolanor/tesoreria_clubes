-- Row Level Security: el mecanismo principal de autorización.
-- Tres capas: políticas (qué filas), grants por columna (qué campos) y triggers (migración 4).
-- Los roles se leen de `miembros.roles` en cada consulta, nunca del JWT: un cambio de rol aplica de inmediato.

-- ---------- Helpers (security definer: leen `miembros` sin recursión de RLS) ----------

-- Ids de miembro del usuario actual (uno por club al que pertenece).
create function private.mis_miembros() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(m.id), '{}')
  from public.miembros m
  where m.auth_user_id = (select auth.uid()) and m.estado <> 'retirado'
$$;

-- Clubes donde el usuario actual tiene alguno de los roles pedidos.
create function private.clubes_con_rol(p_roles public.rol[]) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(m.club_id), '{}')
  from public.miembros m
  where m.auth_user_id = (select auth.uid()) and m.roles && p_roles and m.estado <> 'retirado'
$$;

-- Miembro del usuario actual en un club (para registrar quién hizo algo).
create function private.miembro_actual(p_club_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select m.id from public.miembros m
  where m.auth_user_id = (select auth.uid()) and m.club_id = p_club_id
$$;

create function private.tiene_rol(p_club_id uuid, p_roles public.rol[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_club_id = any(private.clubes_con_rol(p_roles))
$$;

grant execute on function private.mis_miembros(), private.clubes_con_rol(public.rol[]),
  private.miembro_actual(uuid), private.tiene_rol(uuid, public.rol[]) to authenticated;

-- ---------- Privilegios: nada para anon, lectura + columnas puntuales para authenticated ----------

revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

grant select on all tables in schema public to authenticated;

grant insert (club_id, nombre, correo, telefono, categoria, estado, roles) on public.miembros to authenticated;
grant update (nombre, correo, telefono, categoria, estado, roles) on public.miembros to authenticated;

grant insert (club_id, nombre, tipo, monto, fecha_limite, alcance, categoria) on public.eventos_cobro to authenticated;
grant update (nombre, fecha_limite, estado, cancelado_en) on public.eventos_cobro to authenticated;  -- monto/alcance no se editan

grant insert (club_id, evento_id, miembro_id, monto) on public.obligaciones to authenticated;
grant update (monto) on public.obligaciones to authenticated;  -- solo prorrateo; `pagado` nunca por API

grant insert (club_id, miembro_id, monto, fecha_pago, archivo_path) on public.comprobantes to authenticated;
grant update (estado, motivo_rechazo) on public.comprobantes to authenticated;  -- revisado_por/en los fija un trigger

grant insert (club_id, comprobante_id, obligacion_id, monto, origen, regla_id) on public.aplicaciones to authenticated;
grant update (anulada_en, anulada_motivo) on public.aplicaciones to authenticated;

grant insert (club_id, nombre, tipo, parametros, prioridad, activa) on public.reglas_conciliacion to authenticated;
grant update (nombre, parametros, prioridad, activa) on public.reglas_conciliacion to authenticated;
grant delete on public.reglas_conciliacion to authenticated;

grant insert (club_id, mes, saldo_inicial, saldo_final, notas) on public.conciliaciones to authenticated;
grant update (saldo_inicial, saldo_final, notas) on public.conciliaciones to authenticated;
-- bitacora, clubes: solo lectura.

-- ---------- Políticas (una por operación, siempre `to authenticated`) ----------

alter table public.clubes enable row level security;
alter table public.miembros enable row level security;
alter table public.eventos_cobro enable row level security;
alter table public.obligaciones enable row level security;
alter table public.comprobantes enable row level security;
alter table public.aplicaciones enable row level security;
alter table public.reglas_conciliacion enable row level security;
alter table public.conciliaciones enable row level security;
alter table public.bitacora enable row level security;

-- clubes
create policy "Miembros ven su club" on public.clubes for select to authenticated
  using (id = any ((select private.clubes_con_rol('{tesorero,administrativo,jugador}'))::uuid[]));

-- miembros
create policy "Cada quien se ve a sí mismo; tesorería y administración ven el club" on public.miembros
  for select to authenticated
  using (id = any ((select private.mis_miembros())::uuid[])
         or club_id = any ((select private.clubes_con_rol('{tesorero,administrativo}'))::uuid[]));
create policy "Administración agrega miembros" on public.miembros for insert to authenticated
  with check (club_id = any ((select private.clubes_con_rol('{administrativo}'))::uuid[]));
create policy "Administración edita miembros" on public.miembros for update to authenticated
  using (club_id = any ((select private.clubes_con_rol('{administrativo}'))::uuid[]))
  with check (club_id = any ((select private.clubes_con_rol('{administrativo}'))::uuid[]));

-- eventos_cobro
create policy "Miembros ven los eventos del club" on public.eventos_cobro for select to authenticated
  using (club_id = any ((select private.clubes_con_rol('{tesorero,administrativo,jugador}'))::uuid[]));
create policy "Administración crea eventos" on public.eventos_cobro for insert to authenticated
  with check (club_id = any ((select private.clubes_con_rol('{administrativo}'))::uuid[]));
create policy "Administración edita eventos" on public.eventos_cobro for update to authenticated
  using (club_id = any ((select private.clubes_con_rol('{administrativo}'))::uuid[]))
  with check (club_id = any ((select private.clubes_con_rol('{administrativo}'))::uuid[]));

-- obligaciones
create policy "Cada jugador ve sus deudas; tesorería y administración ven el club" on public.obligaciones
  for select to authenticated
  using (miembro_id = any ((select private.mis_miembros())::uuid[])
         or club_id = any ((select private.clubes_con_rol('{tesorero,administrativo}'))::uuid[]));
create policy "Administración crea obligaciones" on public.obligaciones for insert to authenticated
  with check (club_id = any ((select private.clubes_con_rol('{administrativo}'))::uuid[]));
create policy "Administración ajusta obligaciones (prorrateo)" on public.obligaciones for update to authenticated
  using (club_id = any ((select private.clubes_con_rol('{administrativo}'))::uuid[]))
  with check (club_id = any ((select private.clubes_con_rol('{administrativo}'))::uuid[]));

-- comprobantes
create policy "Cada jugador ve los suyos; tesorería y administración ven el club" on public.comprobantes
  for select to authenticated
  using (miembro_id = any ((select private.mis_miembros())::uuid[])
         or club_id = any ((select private.clubes_con_rol('{tesorero,administrativo}'))::uuid[]));
create policy "El jugador sube sus propios comprobantes" on public.comprobantes for insert to authenticated
  with check (miembro_id = any ((select private.mis_miembros())::uuid[])
              and estado = 'pendiente' and canal = 'manual' and revisado_por is null);
create policy "Tesorería revisa comprobantes" on public.comprobantes for update to authenticated
  using (club_id = any ((select private.clubes_con_rol('{tesorero}'))::uuid[]))
  with check (club_id = any ((select private.clubes_con_rol('{tesorero}'))::uuid[]));

-- aplicaciones
create policy "El jugador ve cómo se aplicaron sus pagos; tesorería y administración ven el club" on public.aplicaciones
  for select to authenticated
  using (club_id = any ((select private.clubes_con_rol('{tesorero,administrativo}'))::uuid[])
         or comprobante_id in (select c.id from public.comprobantes c where c.miembro_id = any ((select private.mis_miembros())::uuid[])));
create policy "Tesorería aplica pagos" on public.aplicaciones for insert to authenticated
  with check (club_id = any ((select private.clubes_con_rol('{tesorero}'))::uuid[]));
create policy "Tesorería anula aplicaciones" on public.aplicaciones for update to authenticated
  using (club_id = any ((select private.clubes_con_rol('{tesorero}'))::uuid[]))
  with check (club_id = any ((select private.clubes_con_rol('{tesorero}'))::uuid[]));

-- reglas_conciliacion: solo el tesorero configura (decisión del club); administración solo lee.
create policy "Tesorería y administración ven las reglas" on public.reglas_conciliacion for select to authenticated
  using (club_id = any ((select private.clubes_con_rol('{tesorero,administrativo}'))::uuid[]));
create policy "Tesorería crea reglas" on public.reglas_conciliacion for insert to authenticated
  with check (club_id = any ((select private.clubes_con_rol('{tesorero}'))::uuid[]));
create policy "Tesorería edita reglas" on public.reglas_conciliacion for update to authenticated
  using (club_id = any ((select private.clubes_con_rol('{tesorero}'))::uuid[]))
  with check (club_id = any ((select private.clubes_con_rol('{tesorero}'))::uuid[]));
create policy "Tesorería elimina reglas de evento específico" on public.reglas_conciliacion for delete to authenticated
  using (club_id = any ((select private.clubes_con_rol('{tesorero}'))::uuid[]) and tipo = 'evento_especifico');

-- conciliaciones
create policy "Tesorería y administración ven conciliaciones" on public.conciliaciones for select to authenticated
  using (club_id = any ((select private.clubes_con_rol('{tesorero,administrativo}'))::uuid[]));
create policy "Tesorería registra conciliaciones" on public.conciliaciones for insert to authenticated
  with check (club_id = any ((select private.clubes_con_rol('{tesorero}'))::uuid[]));
create policy "Tesorería actualiza conciliaciones" on public.conciliaciones for update to authenticated
  using (club_id = any ((select private.clubes_con_rol('{tesorero}'))::uuid[]))
  with check (club_id = any ((select private.clubes_con_rol('{tesorero}'))::uuid[]));

-- bitacora: lectura para tesorería y administración; escritura solo por triggers.
create policy "Tesorería y administración leen la bitácora" on public.bitacora for select to authenticated
  using (club_id = any ((select private.clubes_con_rol('{tesorero,administrativo}'))::uuid[]));
