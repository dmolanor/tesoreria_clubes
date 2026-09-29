# Plan de implementación

Fases pensadas para construirse en orden con Claude Code, cada una entregando algo usable. No se estiman tiempos (depende de cuánto tiempo le dediquen) — el orden y el alcance de cada fase sí son deliberados.

## Fase 0 — Fundación

**Objetivo:** proyecto desplegable, vacío pero funcionando de punta a punta.

- Scaffold Next.js (App Router) + TypeScript + Tailwind + shadcn/ui, con los tokens de `DESIGN.md` aplicados desde el inicio (no como ajuste posterior).
- Proyecto Supabase (dev), variables de entorno, cliente Supabase separado para server/browser.
- Supabase Auth con magic link / OTP por correo (sin contraseña).
- Despliegue en Vercel conectado al repo, con preview deployments por PR.
- Lint + typecheck en CI antes de cada merge.

**Fuera de esta fase:** cualquier tabla de negocio, cualquier UI real.

## Fase 1 — Modelo de datos + Administrador

**Objetivo:** el club puede crear su estructura base sin depender de Excel.

- Migraciones de todo el esquema de `02-data-model.md`, incluyendo multi-rol (`miembros.roles`) desde el inicio (multi-rol es real desde el lanzamiento, no se agrega después).
- Políticas RLS base (por `club_id`, por rol activo).
- CRUD de `eventos_cobro` (crear, editar, cancelar con reasignación de pagos ya hechos).
- Carga masiva de jugadores por Excel (nombre + correo → invitación por correo a los nuevos, omite existentes).
- Cambio de estado de jugador (activo/lesionado/retirado) con prorrateo automático del cobro del mes en curso.
- Selector de rol (aunque en esta fase probablemente solo exista un rol por persona en los datos de prueba — la UI ya debe soportarlo).
- Pantalla de inicio de Administrador según `04-ux-ia.md`.

## Fase 2 — Jugador

**Objetivo:** un jugador puede resolver su deuda sin hablarle a la tesorera.

- Pantalla de inicio de Jugador (hero de estado de cuenta, según `04-ux-ia.md`).
- Detalle por evento de cobro.
- Subida de comprobante (monto total, sin elegir evento) a Supabase Storage.
- Estados visuales (al día / pendiente / en mora) con el lenguaje de `DESIGN.md`.

## Fase 3 — Tesorero: núcleo de conciliación

**Objetivo:** el motor de reglas reemplaza el Excel de la tesorera para el día a día.

- Motor de reglas de conciliación (`03-reconciliation-engine.md`): tabla `reglas_conciliacion`, reglas por defecto al crear el club (`monto_exacto` + `mas_antiguo_primero`), lógica de evaluación en orden de prioridad.
- Bandeja de comprobantes pendientes con desglose automático propuesto (trazable a la regla que lo generó).
- Aceptar (aplica + notifica) / rechazar (con motivo + notifica) / editar desglose manualmente antes de aceptar.
- Progreso por evento y por jugador (`04-ux-ia.md`).
- Pantalla de inicio de Tesorero según `04-ux-ia.md`.

**Esta fase es la más importante del proyecto** — es donde vive la diferenciación real frente a un Excel.

## Fase 4 — Conciliación mensual, mora, reglas configurables, bitácora

**Objetivo:** cerrar el ciclo mensual completo y dar autonomía al tesorero sobre las reglas.

- Módulo de conciliación mensual (saldo inicial/final, cálculo de diferencia, historial).
- Vista de jugadores en mora (solo nombres, sin montos, como se definió).
- UI de configuración de reglas de conciliación (solo tesorero): listar, reordenar, activar/desactivar, formulario por tipo.
- Bitácora filtrable integrada en las vistas de Tesorero/Administrador (no como pestaña propia).

## Fase 5 — Notificaciones por correo

**Objetivo:** el sistema avisa sin que nadie tenga que revisar manualmente.

- Comprobante aceptado / rechazado (con motivo).
- Recordatorio 3 días antes de que venza un evento de cobro.
- Alerta al tesorero si la conciliación mensual no cuadra.
- Explícitamente **no** recordatorios automáticos de mora (decisión ya tomada — la presión social vía la lista de mora es intencional, no automatizada por correo).

## Fase 6 (siguiente, ya planeada) — WhatsApp

**Objetivo:** los jugadores interactúan sin salir de WhatsApp; la tesorera gana conciliación semi-automática.

- Recordatorios salientes por WhatsApp (vencimientos, mora).
- Bot simple entrante: jugador envía su comprobante por WhatsApp en vez de (o además de) la web.
- OCR sobre el comprobante recibido para pre-rellenar monto/fecha — **asistido, nunca reemplaza la revisión del tesorero** (el comprobante sigue entrando a la misma bandeja de revisión de Fase 3).
- Requiere decidir proveedor de WhatsApp Business API antes de empezar esta fase — no está definido todavía.

## Fase 7 (evaluar, no confirmada) — Pasarela de pago (Wompi)

Solo si el club decide que vale la comisión (~2.65% + $700 COP + IVA por transacción en el plan agregador de Wompi). Agregaría conciliación automática vía webhook para los pagos que pasen por ahí específicamente — los que sigan yendo por Bre-B directo seguirían el flujo manual de comprobante. No es un rediseño: es un nuevo valor de `comprobantes.canal` + un endpoint que recibe el webhook y genera el comprobante automáticamente en vez de por subida manual.
