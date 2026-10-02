# Modelo de datos

Postgres 17 en Supabase (proyecto "Tesoreria Clubes Ultimate"). La fuente de verdad son las migraciones en `supabase/migrations/`; este documento explica el porqué. Tipos TS generados en `lib/data/database.types.ts` (regenerar tras cada migración).

Todo está aislado por `club_id` para soportar multi-club sin mezclar datos. **Row Level Security es el mecanismo principal de autorización**, no los filtros de la aplicación.

## Decisiones que moldean el esquema

- **13 tablas, sin tablas "por si acaso".** A las 9 de v1 se sumaron `acuerdos_pago` y `cuotas_acuerdo` (planes de pago explícitos) `reglas_recordatorio` y `egresos` (salidas de plata para el cuadre mensual). Lo que el futuro necesita se resolvió con columnas (`canal`, `origen_ref`, `extraccion`, `telefono`), no con tablas vacías. Ver "Fases siguientes".
- **`miembros` = persona dentro de un club** (reemplaza a `usuarios` + `roles_usuario` del diseño original). Los roles son un arreglo (`rol[]`): una persona puede ser jugadora y tesorera a la vez, que es un caso real desde el lanzamiento. El miembro existe *antes* de tener cuenta: se carga desde el Excel y `auth_user_id` se vincula solo, por correo, en su primer login con magic link. Una misma cuenta puede pertenecer a varios clubes (una fila por club).
- **El saldo a favor se deriva, no se guarda.** `aplicaciones` registra qué parte de cada comprobante fue a qué obligación (reemplaza a `pagos_aplicados` + `saldo_a_favor`). El saldo a favor de un comprobante es su monto aceptado menos lo aplicado. Así no hay dos fuentes de verdad que sincronizar.
- **En finanzas no se borra.** Una aplicación se *anula* (`anulada_en`, `anulada_motivo`). Cancelar un evento o prorratear anula aplicaciones, y el dinero vuelve solo al saldo a favor. Un egreso registrado por error también se anula (`anulado_en`) y deja de contar en el cuadre.
- **`club_id` en todas las tablas + FKs compuestas** `(club_id, x_id) → padre(club_id, id)`: la base impide relacionar filas de clubes distintos aunque la app tenga un bug.
- **Dinero en `numeric(14,2)`** (COP): las comisiones de pasarelas (Wompi) generan decimales. Las fechas de negocio son `date`, y "hoy" sale de `clubes.zona_horaria`.
- **Enums para conjuntos cerrados** (roles, estados, tipos de regla, tipos de bitácora, categorías de egreso) y texto para lo que varía por club (categorías, en `clubes.categorias`).

## Tablas

| Tabla | Qué guarda | Claves / reglas |
|---|---|---|
| `clubes` | Club, `categorias text[]`, `zona_horaria`, `moneda` | — |
| `miembros` | Persona en un club: `nombre`, `correo citext`, `telefono` (E.164, WhatsApp), `categoria`, `estado` (activo/lesionado/retirado), `roles rol[]`, `auth_user_id` | unique `(club_id, correo)`; al menos un rol; el club siempre conserva un administrador |
| `eventos_cobro` | Cobro: `tipo` (mensualidad/afiliacion/torneo/uniforme/otro), `monto`, `fecha_limite`, `alcance` (todos/grupo/individual), `categoria`, `estado` | `categoria` solo si alcance = grupo; "individual" = las obligaciones mismas; un evento cancelado no se reactiva |
| `obligaciones` | Deuda de un miembro en un evento: `monto`, `pagado` (lo mantiene un trigger), `estado` (columna generada: pendiente/parcial/pagado) | unique `(evento_id, miembro_id)`; `0 ≤ pagado ≤ monto` |
| `comprobantes` | Pago reportado: `monto`, `fecha_pago` (fecha de la transferencia; la usa la conciliación), `archivo_path` (Storage), `canal` (manual/whatsapp/wompi/compensacion), `origen_ref`, `extraccion` (OCR), `estado`, `motivo_rechazo`, `revisado_por/en` | unique `(club_id, canal, origen_ref)` = idempotencia de webhooks; rechazar exige motivo; no se re-revisa; `canal = 'compensacion'` = cruce de cuentas (sin plata real, sin archivo), lo crea `registrar_cruce` |
| `aplicaciones` | Parte de un comprobante aplicada a una obligación: `monto`, `origen` (propuesta/manual/saldo_a_favor), `regla_id` (auditoría), `anulada_en/motivo` | mismo jugador y club; suma activa ≤ monto del comprobante; cada línea ≤ lo que se debe |
| `reglas_conciliacion` | Motor configurable (ver `03-reconciliation-engine.md`): `tipo`, `parametros jsonb`, `prioridad`, `activa` | prioridad única (diferible, para reordenar); un solo `mas_antiguo_primero` por club, siempre activo y siempre de último |
| `egresos` | Salida de plata de la cuenta del club: `fecha` (la usa la conciliación), `monto`, `concepto`, `categoria` (canchas/nomina/uniformes/torneos/administrativos/polizas/liga_federacion/otros), `categoria_otro` (texto libre, obligatorio solo con `otros`), `evento_id` (qué cobro sustenta, opcional), `comprobante_id` (enlaza un cruce, opcional, único), `soporte_path` (factura o recibo en Storage, opcional), `creado_por`, `anulado_en` | no se edita ni se borra: se anula una vez, salvo el de un cruce (`comprobante_id` no nulo), que no se anula suelto; `fecha` no futura; el soporte vive en `{club_id}/egresos/` |
| `conciliaciones` | Cierre mensual: `mes`, `saldo_inicial/final`, `total_aceptado` y `total_egresos` (snapshots calculados), `diferencia` (generada), `notas` | unique `(club_id, mes)` |
| `acuerdos_pago` | Plan de pagos pactado con un jugador para cubrir una obligación: `miembro_id`, `obligacion_id`, `notas`, `estado` (activo/cancelado) | unique `(club_id, id)`; FKs compuestas; un solo acuerdo activo por obligación (índice parcial); un trigger exige que el acuerdo y la deuda sean del mismo jugador |
| `cuotas_acuerdo` | Cuotas del acuerdo: `numero`, `fecha`, `monto` | unique `(acuerdo_id, numero)`; en cascada con el acuerdo; un trigger bloquea cambios si el acuerdo está cancelado |
| `reglas_recordatorio` | Recordatorios del tesorero: `tipo` (mensual/previo_vencimiento/acuerdo_pago), `dia_mes` o `dias_antes`, `canal` preferido | checks por tipo; escritura solo de tesorería; sin bitácora (es configuración) |
| `bitacora` | Eventos de negocio: `tipo` (enum cerrado de 12 valores), `actor_id`, `objetivo_tipo/id`, `descripcion`, `metadata` | append-only (un trigger bloquea update/delete, incluso con service role); índice `(club_id, created_at desc, id desc)` para paginar por cursor |

**Una sola cuenta bancaria por club.** Ni `conciliaciones` ni `egresos` distinguen cuentas: si un club llega a manejar varias, se agrega `cuenta` a ambas tablas y la conciliación pasa a ser por `(club_id, mes, cuenta)`.

**Vistas** (`security_invoker`, respetan RLS): `estado_cuenta_miembros` (pendiente, vencido, próximo vencimiento, saldo a favor, estado al_dia/pendiente/mora) y `progreso_eventos` (pagadas/total, recaudado/total, `con_acuerdo`: obligaciones impagas con acuerdo activo).

## Autorización

- **Políticas por fila**, una por operación, siempre `to authenticated`. `anon` no tiene acceso a nada. Helpers `security definer` en el esquema `private` (no expuesto): `mis_miembros()` y `clubes_con_rol(rol[])`, envueltos en `(select …)` para que se evalúen una vez por consulta.
- **Los roles se leen de `miembros.roles` en cada consulta, nunca del JWT**: quitarle un rol a alguien aplica de inmediato.
- **Grants por columna**: el jugador inserta sus comprobantes pero no puede tocar `estado`; nadie escribe `obligaciones.pagado`, `total_aceptado`, `total_egresos` ni la bitácora por API. De un egreso solo se actualiza `anulado_en`.
- **Triggers para lo que RLS no expresa**: `revisado_por` y `creado_por` los fija la base (no se pueden suplantar), validaciones de aplicaciones, FIFO siempre último, club nunca sin admin.
- **Quién hace qué:** el jugador ve lo suyo y sube comprobantes. El tesorero revisa, aplica, concilia, **registra y anula egresos**, **registra cruces de cuentas**, registra acuerdos de pago y **es el único que configura reglas**. El jugador ve sus propios acuerdos pero no los crea ni los edita (tampoco el bot de WhatsApp: solo los consulta). El administrador crea y cancela eventos, gestiona jugadores, **registra y anula egresos** (igual que el tesorero, no registra cruces) y lee reglas, acuerdos y conciliación. El jugador no ve egresos. La bitácora la leen tesorería y administración.
- **Storage:** bucket privado `comprobantes`, ruta `{club_id}/{miembro_id}/{archivo}`. Cada jugador sube y lee su carpeta; tesorería y administración leen la del club. Los soportes de egresos van al mismo bucket en `{club_id}/egresos/{archivo}`: solo tesorería sube ahí, y tesorería y administración los leen con la misma política de lectura del club (un jugador no, porque `egresos` no es un id de miembro). Nadie edita ni borra archivos.

Pruebas: `supabase/tests/rls.sql` (cuatro bloques: RLS general, Storage y prorrateo, egresos y cuadre, cruces de cuentas; se ejecutan como postgres y se revierten solos).

## Escrituras de negocio (RPC)

Las escrituras que tocan varias filas son funciones Postgres `security invoker` (RLS aplica dentro), en una sola transacción:
- `aceptar_comprobante`
- `crear_evento` (aplica saldos a favor existentes)
- `cancelar_evento`
- `cambiar_estado_miembro(miembro, estado, fecha_efectiva)`: al dejar de estar activo prorratea la mensualidad del mes de la fecha efectiva, proporcional a los días hasta esa fecha y con el piso de `private.prorrateo_piso()`. La fecha es opcional (por defecto, hoy en la zona horaria del club) y no puede ser futura. Si cae en un mes ya pagado completo, el monto baja igual y el excedente queda como saldo a favor del jugador. Entre estados no activos o hacia activo la fecha solo queda en la bitácora ("desde el 21/09/2026").
- `reordenar_reglas`
- `agregar_regla_evento`
- `guardar_conciliacion`
- `registrar_cruce(miembro_id, monto, fecha, concepto, lineas)`: cruce de cuentas con un jugador que trabaja para el club (ej. entrena a cambio de un pago). Solo tesorería. En una transacción: inserta un comprobante de compensación (`canal = 'compensacion'`, sin archivo), lo acepta con `aceptar_comprobante` y el desglose que propone el motor, y registra el egreso de nómina (`categoria = 'nomina'`) enlazado por `comprobante_id`. `security definer` porque escribe `canal` y `egresos.comprobante_id`, columnas sin grant directo al cliente; valida el rol internamente, igual que los helpers de saldo a favor.

El motor de reglas vive en TypeScript (`lib/engine/`): **propone**, y la base valida y escribe. Las operaciones simples (subir o rechazar un comprobante, activar una regla, editar un evento) son escrituras directas bajo RLS.

## Cuadre de la conciliación mensual

La conciliación compara lo que la plataforma dice que debió moverse la cuenta con lo que el extracto dice que se movió:

```
esperado   = ingresos aceptados del mes − egresos no anulados del mes
banco      = saldo_final − saldo_inicial
diferencia = banco − esperado        (0 = cuadrada)
```

Los ingresos son los comprobantes aceptados cuya `fecha_pago` cae en el mes y los egresos, los no anulados cuya `fecha` cae en el mes. Al guardar, un trigger fija `total_aceptado` y `total_egresos` como snapshot, y `diferencia` es una columna generada con la misma fórmula. Si después se acepta un comprobante o se registra o anula un egreso de ese mes, la conciliación guardada no cambia hasta que la tesorería la vuelve a guardar. La pantalla de Conciliación calcula el cuadre en vivo con `cuadreMes()` (`lib/cuadre.ts`), que replica la fórmula y tiene pruebas en `lib/cuadre.test.ts`.

**Un cruce de cuentas no mueve el banco.** `total_aceptado` excluye los comprobantes con `canal = 'compensacion'` y `total_egresos` excluye los egresos con `comprobante_id` no nulo (`private.conciliaciones_calcular`); los dos lados de un cruce se anulan entre sí frente al extracto. En TypeScript, `totalAceptadoMes` (`lib/db/tesoreria.ts`) y `egresosMes` (`lib/db/egresos.ts`) aplican la misma exclusión con los helpers `esCompensacion`/`esEgresoDeCruce` de `lib/cuadre.ts`.

## Bitácora

Solo eventos significativos, nunca lecturas. Registrar y anular un egreso son eventos (`egreso_registrado`, `egreso_anulado`, con el monto formateado). La escriben triggers, así que queda completa sin importar desde dónde se hizo el cambio. Para un club el volumen es de cientos de filas al mes. Si se vuelve multi-club grande, se evalúa particionar por `(club_id, created_at)`; por ahora no se optimiza por adelantado.

## Fases siguientes (sin tablas vacías hoy)

- **Correos (fase 5):** tabla `notificaciones` como outbox, con unique por tipo + objetivo + miembro para no duplicar recordatorios.
- **WhatsApp + OCR (fase 6):** no requiere tablas. Usa `comprobantes.canal = 'whatsapp'`, `origen_ref` (id del mensaje), `extraccion` y `miembros.telefono`. El bot consulta acuerdos de pago con permiso de lectura; la RLS (escritura solo de tesorería) ya le impide crearlos.
- **Wompi (fase 7):** columna `comision` en `comprobantes` y un webhook idempotente por `origen_ref`.
- **Alta de clubes nuevos:** no requiere tablas.

## Pendiente de confirmar con el club (`TODO(club)` en el SQL)

- Fórmula del prorrateo: hoy es proporcional a los días del mes, con un piso del 50% (`private.prorrateo_piso()`).
- Si los lesionados reciben cobros nuevos: hoy solo los activos, salvo selección individual.
