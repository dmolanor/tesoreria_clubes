-- Recordatorios que gestiona el tesorero: reglas recurrentes (un día del mes,
-- X días antes del vencimiento, fechas de acuerdos de pago). La app genera el
-- texto listo para copiar a WhatsApp; el envío automático llega cuando se elija
-- proveedor (`canal` ya guarda la preferencia para no rediseñar).

create type public.tipo_recordatorio as enum ('mensual', 'previo_vencimiento', 'acuerdo_pago');

create table public.reglas_recordatorio (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubes (id),
  nombre     text not null check (length(trim(nombre)) > 0),
  tipo       public.tipo_recordatorio not null,
  activa     boolean not null default true,
  dia_mes    int,   -- solo 'mensual': día del mes en que se recuerda
  dias_antes int,   -- solo 'previo_vencimiento': días antes del límite
  canal      text not null default 'whatsapp',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, id),
  check (tipo <> 'mensual' or (dia_mes between 1 and 28 and dias_antes is null)),
  check (tipo <> 'previo_vencimiento' or (dias_antes between 1 and 30 and dia_mes is null)),
  check (tipo <> 'acuerdo_pago' or (dia_mes is null and dias_antes is null))
);
create index reglas_recordatorio_club_idx on public.reglas_recordatorio (club_id, activa);

create trigger set_updated_at before update on public.reglas_recordatorio
  for each row execute function private.set_updated_at();

alter table public.reglas_recordatorio enable row level security;

grant select on public.reglas_recordatorio to authenticated;
grant insert (club_id, nombre, tipo, activa, dia_mes, dias_antes, canal) on public.reglas_recordatorio to authenticated;
grant update (nombre, tipo, activa, dia_mes, dias_antes, canal) on public.reglas_recordatorio to authenticated;
grant delete on public.reglas_recordatorio to authenticated;

create policy "Tesorería y administración ven los recordatorios" on public.reglas_recordatorio
  for select to authenticated
  using (club_id = any ((select private.clubes_con_rol('{tesorero,administrativo}'))::uuid[]));
create policy "Tesorería crea recordatorios" on public.reglas_recordatorio for insert to authenticated
  with check (club_id = any ((select private.clubes_con_rol('{tesorero}'))::uuid[]));
create policy "Tesorería edita recordatorios" on public.reglas_recordatorio for update to authenticated
  using (club_id = any ((select private.clubes_con_rol('{tesorero}'))::uuid[]))
  with check (club_id = any ((select private.clubes_con_rol('{tesorero}'))::uuid[]));
create policy "Tesorería elimina recordatorios" on public.reglas_recordatorio for delete to authenticated
  using (club_id = any ((select private.clubes_con_rol('{tesorero}'))::uuid[]));
