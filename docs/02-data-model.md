# Modelo de datos

Postgres 17 en Supabase (proyecto "Tesoreria Clubes Ultimate"). La fuente de verdad son las migraciones en `supabase/migrations/`; este documento explica el porqué. Tipos TS generados en `lib/data/database.types.ts` (regenerar tras cada migración).

Todo está aislado por `club_id` para soportar multi-club sin mezclar datos. **Row Level Security es el mecanismo principal de autorización**, no los filtros de la aplicación.

## Decisiones que moldean el esquema

- **9 tablas, sin tablas "por si acaso".** Lo que el futuro necesita se resolvió con columnas (`canal`, `origen_ref`, `extraccion`, `telefono`), no con tablas vacías. Ver "Fases siguientes".
- **`miembros` = persona dentro de un club** (reemplaza a `usuarios` + `roles_usuario` del diseño original). Los roles son un arreglo (`rol[]`): una persona puede ser jugadora y tesorera a la vez, que es un caso real desde el lanzamiento. El miembro existe *antes* de tener cuenta: se carga desde el Excel y `auth_user_id` se vincula solo, por correo, en su primer login con magic link. Una misma cuenta puede pertenecer a varios clubes (una fila por club).
- **El saldo a favor se deriva, no se guarda.** `aplicaciones` registra qué parte de cada comprobante fue a qué obligación (reemplaza a `pagos_aplicados` + `saldo_a_favor`). El saldo a favor de un comprobante es su monto aceptado menos lo aplicado. Así no hay dos fuentes de verdad que sincronizar.
- **En finanzas no se borra.** Una aplicación se *anula* (`anulada_en`, `anulada_motivo`). Cancelar un evento o prorratear anula aplicaciones, y el dinero vuelve solo al saldo a favor.
- **`club_id` en todas las tablas + FKs compuestas** `(club_id, x_id) → padre(club_id, id)`: la base impide relacionar filas de clubes distintos aunque la app tenga un bug.
- **Dinero en `numeric(14,2)`** (COP): las comisiones de pasarelas (Wompi) generan decimales. Las fechas de negocio son `date`, y "hoy" sale de `clubes.zona_horaria`.
- **Enums para conjuntos cerrados** (roles, estados, tipos de regla, tipos de bitácora) y texto para lo que varía por club (categorías, en `clubes.categorias`).

## Tablas

| Tabla | Qué guarda | Claves / reglas |
|---|---|---|
| `clubes` | Club, `categorias text[]`, `zona_horaria`, `moneda` | — |
| `miembros` | Persona en un club: `nombre`, `correo citext`, `telefono` (E.164, WhatsApp), `categoria`, `estado` (activo/lesionado/retirado), `roles rol[]`, `auth_user_id` | unique `(club_id, correo)`; al menos un rol; el club siempre conserva un administrador |
| `eventos_cobro` | Cobro: `tipo` (mensualidad/afiliacion/torneo/uniforme/otro), `monto`, `fecha_limite`, `alcance` (todos/grupo/individual), `categoria`, `estado` | `categoria` solo si alcance = grupo; "individual" = las obligaciones mismas; un evento cancelado no se reactiva |
| `obligaciones` | Deuda de un miembro en un evento: `monto`, `pagado` (lo mantiene un trigger), `estado` (columna generada: pendiente/parcial/pagado) | unique `(evento_id, miembro_id)`; `0 ≤ pagado ≤ monto` |
| `comprobantes` | Pago reportado: `monto`, `fecha_pago` (fecha de la transferencia; la usa la conciliación), `archivo_path` (Storage), `canal` (manual/whatsapp/wompi), `origen_ref`, `extraccion` (OCR), `estado`, `motivo_rechazo`, `revisado_por/en` | unique `(club_id, canal, origen_ref)` = idempotencia de webhooks; rechazar exige motivo; no se re-revisa |
| `aplicaciones` | Parte de un comprobante aplicada a una obligación: `monto`, `origen` (propuesta/manual/saldo_a_favor), `regla_id` (auditoría), `anulada_en/motivo` | mismo jugador y club; suma activa ≤ monto del comprobante; cada línea ≤ lo que se debe |
| `reglas_conciliacion` | Motor configurable (ver `03-reconciliation-engine.md`): `tipo`, `parametros jsonb`, `prioridad`, `activa` | prioridad única (diferible, para reordenar); un solo `mas_antiguo_primero` por club, siempre activo y siempre de último |
| `conciliaciones` | Cierre mensual: `mes`, `saldo_inicial/final`, `total_aceptado` (snapshot calculado), `diferencia` (generada), `notas` | unique `(club_id, mes)` |
| `bitacora` | Eventos de negocio: `tipo` (enum cerrado de 9 valores), `actor_id`, `objetivo_tipo/id`, `descripcion`, `metadata` | append-only (un trigger bloquea update/delete, incluso con service role); índice `(club_id, created_at desc, id desc)` para paginar por cursor |

**Vistas** (`security_invoker`, respetan RLS): `estado_cuenta_miembros` (pendiente, vencido, próximo vencimiento, saldo a favor, estado al_dia/pendiente/mora) y `progreso_eventos` (pagadas/total, recaudado/total).

## Autorización

- **Políticas por fila**, una por operación, siempre `to authenticated`. `anon` no tiene acceso a nada. Helpers `security definer` en el esquema `private` (no expuesto): `mis_miembros()` y `clubes_con_rol(rol[])`, envueltos en `(select …)` para que se evalúen una vez por consulta.
- **Los roles se leen de `miembros.roles` en cada consulta, nunca del JWT**: quitarle un rol a alguien aplica de inmediato.
- **Grants por columna**: el jugador inserta sus comprobantes pero no puede tocar `estado`; nadie escribe `obligaciones.pagado`, `total_aceptado` ni la bitácora por API.
- **Triggers para lo que RLS no expresa**: `revisado_por` y `creado_por` los fija la base (no se pueden suplantar), validaciones de aplicaciones, FIFO siempre último, club nunca sin admin.
- **Quién hace qué:** el jugador ve lo suyo y sube comprobantes. El tesorero revisa, aplica, concilia y **es el único que configura reglas**. El administrador crea y cancela eventos y gestiona jugadores, y lee reglas y conciliación. La bitácora la leen tesorería y administración.
- **Storage:** bucket privado `comprobantes`, ruta `{club_id}/{miembro_id}/{archivo}`. Cada jugador sube y lee su carpeta; tesorería y administración leen la del club. Nadie edita ni borra archivos.

Pruebas: `supabase/tests/rls.sql` (46 verificaciones, se ejecutan como postgres y se revierten solas).

## Escrituras de negocio (RPC)

Las escrituras que tocan varias filas son funciones Postgres `security invoker` (RLS aplica dentro), en una sola transacción:
- `aceptar_comprobante`
- `crear_evento` (aplica saldos a favor existentes)
- `cancelar_evento`
- `cambiar_estado_miembro` (prorratea la mensualidad del mes)
- `reordenar_reglas`
- `agregar_regla_evento`
- `guardar_conciliacion`

El motor de reglas vive en TypeScript (`lib/engine/`): **propone**, y la base valida y escribe. Las operaciones simples (subir o rechazar un comprobante, activar una regla, editar un evento) son escrituras directas bajo RLS.

## Bitácora

Solo eventos significativos, nunca lecturas. La escriben triggers, así que queda completa sin importar desde dónde se hizo el cambio. Para un club el volumen es de cientos de filas al mes. Si se vuelve multi-club grande, se evalúa particionar por `(club_id, created_at)`; por ahora no se optimiza por adelantado.

## Fases siguientes (sin tablas vacías hoy)

- **Correos (fase 5):** tabla `notificaciones` como outbox, con unique por tipo + objetivo + miembro para no duplicar recordatorios.
- **WhatsApp + OCR (fase 6):** no requiere tablas. Usa `comprobantes.canal = 'whatsapp'`, `origen_ref` (id del mensaje), `extraccion` y `miembros.telefono`.
- **Wompi (fase 7):** columna `comision` en `comprobantes` y un webhook idempotente por `origen_ref`.
- **Alta de clubes nuevos:** no requiere tablas.

## Pendiente de confirmar con el club (`TODO(club)` en el SQL)

- Fórmula del prorrateo: hoy es proporcional a los días del mes, con un piso del 50% (`private.prorrateo_piso()`).
- Si los lesionados reciben cobros nuevos: hoy solo los activos, salvo selección individual.
