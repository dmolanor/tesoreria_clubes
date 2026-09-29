-- Las 9 tablas del dominio. `club_id` en todas + FKs compuestas (club_id, x_id):
-- es imposible relacionar filas de clubes distintos aunque la app falle.
-- Dinero en numeric(14,2) (COP; las comisiones de pasarelas generan decimales).

create table public.clubes (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null check (length(trim(nombre)) > 0),
  categorias   text[] not null default '{}',           -- ej. {Élite,Junior}: varían por club
  zona_horaria text not null default 'America/Bogota',  -- define "hoy" para vencimientos
  moneda       char(3) not null default 'COP',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Pertenencia de una persona a un club (antes usuarios + roles_usuario).
-- Existe antes de que la persona tenga cuenta; `auth_user_id` se vincula en su primer login.
create table public.miembros (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubes (id),
  auth_user_id uuid references auth.users (id) on delete set null,
  nombre       text not null check (length(trim(nombre)) > 0),
  correo       extensions.citext not null check (correo ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telefono     text check (telefono ~ '^\+[1-9][0-9]{7,14}$'),  -- E.164, para WhatsApp (fase 6)
  categoria    text,
  estado       public.estado_miembro not null default 'activo',
  roles        public.rol[] not null default '{jugador}' check (cardinality(roles) > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (club_id, id),
  unique (club_id, correo),
  unique (club_id, auth_user_id)
);
-- Lo usan todos los helpers de RLS.
create index miembros_auth_user_idx on public.miembros (auth_user_id) include (club_id, roles, estado)
  where auth_user_id is not null;

create table public.eventos_cobro (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubes (id),
  nombre       text not null check (length(trim(nombre)) > 0),
  tipo         public.tipo_cobro not null default 'otro',
  monto        numeric(14, 2) not null check (monto > 0),
  fecha_limite date not null,
  alcance      public.alcance_cobro not null,
  categoria    text,  -- solo para alcance 'grupo'; 'individual' = las obligaciones mismas
  estado       public.estado_evento not null default 'activo',
  cancelado_en timestamptz,
  creado_por   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (club_id, id),
  foreign key (club_id, creado_por) references public.miembros (club_id, id),
  check ((alcance = 'grupo') = (categoria is not null)),
  check ((estado = 'cancelado') = (cancelado_en is not null))
);
create index eventos_cobro_club_fecha_idx on public.eventos_cobro (club_id, estado, fecha_limite);
create index eventos_cobro_creado_por_idx on public.eventos_cobro (club_id, creado_por);

create table public.obligaciones (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null,
  evento_id  uuid not null,
  miembro_id uuid not null,
  monto      numeric(14, 2) not null check (monto >= 0),
  pagado     numeric(14, 2) not null default 0,  -- lo mantiene un trigger desde `aplicaciones`
  estado     text generated always as (
               case when pagado >= monto then 'pagado' when pagado > 0 then 'parcial' else 'pendiente' end
             ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, id),
  unique (evento_id, miembro_id),
  foreign key (club_id, evento_id) references public.eventos_cobro (club_id, id),
  foreign key (club_id, miembro_id) references public.miembros (club_id, id),
  constraint obligaciones_pagado_valido check (pagado >= 0 and pagado <= monto)
);
create index obligaciones_evento_idx on public.obligaciones (club_id, evento_id);
create index obligaciones_miembro_idx on public.obligaciones (club_id, miembro_id);
create index obligaciones_miembro_rls_idx on public.obligaciones (miembro_id);

create table public.comprobantes (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null,
  miembro_id     uuid not null,
  monto          numeric(14, 2) not null check (monto > 0),
  fecha_pago     date not null default current_date,  -- fecha de la transferencia: la usa la conciliación
  archivo_path   text,                                -- ruta en Storage (bucket `comprobantes`)
  canal          public.canal_comprobante not null default 'manual',
  origen_ref     text,   -- id del mensaje de WhatsApp / transacción Wompi: idempotencia
  extraccion     jsonb,  -- resultado de OCR (fase 6), siempre asistido
  estado         public.estado_comprobante not null default 'pendiente',
  motivo_rechazo text,
  revisado_por   uuid,
  revisado_en    timestamptz,
  created_at     timestamptz not null default now(),  -- fecha de carga
  unique (club_id, id),
  unique (club_id, canal, origen_ref),
  foreign key (club_id, miembro_id) references public.miembros (club_id, id),
  foreign key (club_id, revisado_por) references public.miembros (club_id, id),
  check ((estado = 'rechazado') = (coalesce(length(trim(motivo_rechazo)), 0) > 0)),
  check ((estado = 'pendiente') = (revisado_en is null))
);
create index comprobantes_bandeja_idx on public.comprobantes (club_id, estado, created_at desc);
create index comprobantes_miembro_idx on public.comprobantes (club_id, miembro_id, created_at desc);
create index comprobantes_miembro_rls_idx on public.comprobantes (miembro_id);
create index comprobantes_revisado_por_idx on public.comprobantes (club_id, revisado_por);

create table public.reglas_conciliacion (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubes (id),
  nombre     text not null check (length(trim(nombre)) > 0),
  tipo       public.tipo_regla not null,
  parametros jsonb not null default '{}',
  prioridad  int not null check (prioridad > 0),
  activa     boolean not null default true,
  creado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, id),
  -- diferible: reordenar intercambia prioridades dentro de una transacción
  constraint reglas_prioridad_unica unique (club_id, prioridad) deferrable initially deferred,
  foreign key (club_id, creado_por) references public.miembros (club_id, id),
  constraint reglas_fifo_siempre_activa check (tipo <> 'mas_antiguo_primero' or activa),
  constraint reglas_evento_con_parametro check (tipo <> 'evento_especifico' or parametros ? 'evento_id')
);
-- Un único respaldo FIFO por club.
create unique index reglas_un_fifo_por_club on public.reglas_conciliacion (club_id) where tipo = 'mas_antiguo_primero';
create index reglas_creado_por_idx on public.reglas_conciliacion (club_id, creado_por);

-- Qué parte de un comprobante fue a qué obligación (antes pagos_aplicados + saldo_a_favor).
-- Saldo a favor de un comprobante = monto aceptado − Σ aplicaciones activas: se deriva, no se guarda.
-- En finanzas no se borra: una aplicación se anula.
create table public.aplicaciones (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null,
  comprobante_id uuid not null,
  obligacion_id  uuid not null,
  monto          numeric(14, 2) not null check (monto > 0),
  origen         public.origen_aplicacion not null,
  regla_id       uuid,  -- qué regla la propuso (auditoría); null si fue manual o saldo a favor
  creado_por     uuid,
  anulada_en     timestamptz,
  anulada_motivo text,
  created_at     timestamptz not null default now(),
  foreign key (club_id, comprobante_id) references public.comprobantes (club_id, id),
  foreign key (club_id, obligacion_id) references public.obligaciones (club_id, id),
  foreign key (club_id, regla_id) references public.reglas_conciliacion (club_id, id) on delete set null (regla_id),
  foreign key (club_id, creado_por) references public.miembros (club_id, id),
  check ((anulada_en is null) = (anulada_motivo is null)),
  check (origen = 'propuesta' or regla_id is null)
);
create index aplicaciones_comprobante_idx on public.aplicaciones (club_id, comprobante_id);
create index aplicaciones_obligacion_idx on public.aplicaciones (club_id, obligacion_id);
create index aplicaciones_activas_obligacion_idx on public.aplicaciones (obligacion_id) where anulada_en is null;
create index aplicaciones_activas_comprobante_idx on public.aplicaciones (comprobante_id) where anulada_en is null;
create index aplicaciones_regla_idx on public.aplicaciones (club_id, regla_id);
create index aplicaciones_creado_por_idx on public.aplicaciones (club_id, creado_por);

create table public.conciliaciones (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references public.clubes (id),
  mes            date not null check (extract(day from mes) = 1),
  saldo_inicial  numeric(14, 2) not null,
  saldo_final    numeric(14, 2) not null,
  total_aceptado numeric(14, 2) not null default 0,  -- snapshot; lo calcula un trigger
  diferencia     numeric(14, 2) generated always as (saldo_final - saldo_inicial - total_aceptado) stored,
  notas          text,
  creado_por     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (club_id, mes),
  foreign key (club_id, creado_por) references public.miembros (club_id, id)
);
create index conciliaciones_creado_por_idx on public.conciliaciones (club_id, creado_por);

-- Solo eventos de negocio significativos, nunca lecturas. Append-only.
create table public.bitacora (
  id            bigint generated always as identity primary key,
  club_id       uuid not null references public.clubes (id),
  tipo          public.tipo_bitacora not null,
  actor_id      uuid,  -- null = sistema
  objetivo_tipo public.objetivo_bitacora not null,
  objetivo_id   uuid not null,
  descripcion   text not null,
  metadata      jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  foreign key (club_id, actor_id) references public.miembros (club_id, id)
);
create index bitacora_cursor_idx on public.bitacora (club_id, created_at desc, id desc);
create index bitacora_actor_idx on public.bitacora (club_id, actor_id);

create trigger set_updated_at before update on public.clubes for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.miembros for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.eventos_cobro for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.obligaciones for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.reglas_conciliacion for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.conciliaciones for each row execute function private.set_updated_at();
