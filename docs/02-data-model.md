# Modelo de datos

Postgres vía Supabase. Todo aislado por `club_id` para soportar multi-club a futuro sin mezclar datos. Row Level Security (RLS) es el mecanismo principal de autorización — no confiar en filtros solo del lado de la aplicación.

Este esquema extiende el diseño original del compañero en tres puntos, todos derivados de decisiones explícitas del club: **multi-rol por persona**, **reglas de conciliación configurables** (en vez de FIFO fijo) y una **bitácora unificada de eventos**.

## Tablas

### `clubes`
```
id            uuid pk
nombre        text
created_at    timestamptz
```

### `usuarios`
Identidad, sin rol embebido (el rol vive en `roles_usuario` — ver más abajo).
```
id            uuid pk  -- = auth.users.id de Supabase Auth
club_id       uuid fk -> clubes.id
nombre        text
correo        text unique
categoria     text   -- 'Élite' | 'Junior' | null (aplica a jugadores)
estado        text   -- 'activo' | 'lesionado' | 'retirado'
created_at    timestamptz
```

### `roles_usuario`
Una persona puede tener varios roles a la vez (ej. tesorero que también juega). Esta tabla existe *desde v1*, no es preparación para el futuro — hay un caso real hoy.
```
id            uuid pk
usuario_id    uuid fk -> usuarios.id
club_id       uuid fk -> clubes.id
rol           text    -- 'administrativo' | 'tesorero' | 'jugador'
activo        boolean default true
created_at    timestamptz

unique (usuario_id, club_id, rol)
```
La UI resuelve esto con un selector de rol tipo pestañas cuando `count(roles activos) > 1` (ver `04-ux-ia.md`) — nunca duplicando menús completos por rol.

### `eventos_cobro`
```
id              uuid pk
club_id         uuid fk -> clubes.id
nombre          text
monto           numeric(12,2)
fecha_limite    date
alcance         text      -- 'todos' | 'grupo' | 'individual'
alcance_valor   text null -- categoría o usuario_id según 'alcance'
fecha_creacion  timestamptz
estado          text      -- 'activo' | 'cancelado'
```

### `obligaciones`
La deuda individual de un jugador dentro de un evento de cobro.
```
id              uuid pk
evento_cobro_id uuid fk -> eventos_cobro.id
usuario_id      uuid fk -> usuarios.id
monto           numeric(12,2)
estado          text  -- 'pendiente' | 'parcial' | 'pagado'
created_at      timestamptz
```

### `comprobantes`
```
id              uuid pk
usuario_id      uuid fk -> usuarios.id
archivo_url     text     -- Supabase Storage
monto_total     numeric(12,2)
canal           text default 'manual'  -- 'manual' | 'wompi' | ... (futuro-proof, no usado aún)
fecha_carga     timestamptz
estado          text     -- 'pendiente' | 'aceptado' | 'rechazado'
motivo_rechazo  text null
revisado_por    uuid fk -> usuarios.id null
revisado_en     timestamptz null
```

### `pagos_aplicados`
El desglose: qué parte de un comprobante fue a qué obligación. Se genera automáticamente por el motor de reglas (ver `03-reconciliation-engine.md`) y puede editarse antes de aceptar.
```
id              uuid pk
comprobante_id  uuid fk -> comprobantes.id
obligacion_id   uuid fk -> obligaciones.id null  -- null = saldo a favor sin asignar
monto_aplicado  numeric(12,2)
regla_aplicada  uuid fk -> reglas_conciliacion.id null  -- qué regla produjo esta línea (auditoría)
```

### `saldo_a_favor`
Dinero de un comprobante que no se pudo aplicar a ninguna obligación pendiente, para consumir automáticamente en el siguiente evento de cobro del jugador.
```
id              uuid pk
usuario_id      uuid fk -> usuarios.id
monto           numeric(12,2)
origen_comprobante_id uuid fk -> comprobantes.id
consumido       boolean default false
consumido_en_obligacion_id uuid fk -> obligaciones.id null
created_at      timestamptz
```

### `reglas_conciliacion`
El motor de reglas configurable — ver `03-reconciliation-engine.md` para el diseño completo. Solo el **tesorero** puede crear/editar/reordenar/desactivar reglas de su club (decisión explícita del club: el admin no configura esto).
```
id              uuid pk
club_id         uuid fk -> clubes.id
nombre          text
tipo            text      -- 'monto_exacto' | 'mas_antiguo_primero' | 'evento_especifico' | ... (enum extensible)
condicion       jsonb     -- parámetros de cuándo aplica
accion          jsonb     -- parámetros de cómo aplica el monto
prioridad       int       -- orden de evaluación, ascendente
activa          boolean default true
creado_por      uuid fk -> usuarios.id
created_at      timestamptz
updated_at      timestamptz
```

### `conciliaciones`
```
id              uuid pk
club_id         uuid fk -> clubes.id
mes             date     -- primer día del mes
saldo_inicial   numeric(12,2)
saldo_final     numeric(12,2)
total_aceptado  numeric(12,2)  -- calculado: suma de comprobantes aceptados en el mes
diferencia      numeric(12,2)  -- calculado
notas           text null
creado_por      uuid fk -> usuarios.id
created_at      timestamptz
```

### `bitacora`
Log unificado de eventos de negocio del club, filtrable. **Solo eventos significativos** (nunca vistas/lecturas) para que no crezca sin control — ver `04-ux-ia.md` para cómo se consume en UI y cuándo archivar.
```
id              uuid pk
club_id         uuid fk -> clubes.id
tipo            text     -- enum cerrado, ver abajo
actor_id        uuid fk -> usuarios.id null  -- null = sistema (ej. recordatorio automático)
objetivo_tipo   text     -- 'usuario' | 'evento_cobro' | 'comprobante' | 'conciliacion'
objetivo_id     uuid
descripcion     text     -- texto corto ya formateado, ej. "Camila Ruiz subió un comprobante de $180.000"
metadata        jsonb    -- datos estructurados adicionales (monto, motivo, etc.)
created_at      timestamptz

index (club_id, created_at desc)  -- para paginación por fecha
```
Tipos de evento v1 (enum cerrado — agregar valores requiere migración deliberada, no un campo libre):
`evento_cobro_creado`, `evento_cobro_cancelado`, `jugador_creado`, `jugador_estado_cambiado`, `comprobante_subido`, `comprobante_aceptado`, `comprobante_rechazado`, `conciliacion_guardada`, `regla_conciliacion_cambiada`.

## RLS — principios

- Un jugador solo lee/escribe sus propios `comprobantes`, `obligaciones`, `saldo_a_favor`.
- Tesorero y administrador solo operan dentro de su propio `club_id` (join contra `roles_usuario` activo).
- `reglas_conciliacion`: lectura para tesorero y admin del club; escritura solo para tesorero.
- `bitacora`: lectura para tesorero y admin del club; nunca editable ni borrable desde la aplicación (append-only).
- Toda fila con `usuario_id`/`club_id` se resuelve contra `auth.uid()` + `roles_usuario`, nunca contra un rol embebido estático en el JWT — porque el rol puede cambiar y una persona puede tener varios.

## Nota sobre crecimiento de `bitacora`

Para un solo club el volumen es bajo (cientos de eventos al mes, no miles) — no hace falta una estrategia de archivado en v1. Si esto se vuelve multi-club, considerar particionar por `club_id, created_at` o mover a una tabla fría después de N meses. No optimizar por adelantado.
