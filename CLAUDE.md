# Contexto del proyecto — Raza Ultimate Tesorería

Lee este archivo completo antes de escribir código. Si vas a tocar UI, lee también `DESIGN.md` antes de escribir markup o estilos — sin excepción, incluso para un cambio pequeño.

## Qué es esto

Plataforma para que un club de Ultimate Frisbee (~50 jugadores entre categoría Élite y Junior) gestione cobros (mensualidades, torneos, uniformes, etc.), reciba comprobantes de pago, los concilie contra las obligaciones de cada jugador, y cuadre las cuentas bancarias del club mes a mes. Hoy esto se hace a mano en un Excel de la tesorera y por WhatsApp/correo; el dolor real no es el canal de cobro (ya funciona bien por transferencia con llave Bre-B), sino la visibilidad de quién debe qué y el trabajo manual de conciliar comprobantes contra deudas.

Diseñada desde el día 1 para que, en el futuro, otros clubes la usen sin mezclar sus datos (`club_id` en todo).

## Stack y decisiones de infraestructura

- **Next.js (App Router) + TypeScript** para frontend y backend en un solo proyecto (server actions / route handlers). Sin backend separado — mantener la infraestructura simple es un requisito explícito del producto, no solo técnico.
- **Supabase**: Postgres, Supabase Auth (magic link / OTP por correo — sin contraseñas, para no añadir fricción a jugadores no técnicos), Storage (comprobantes), Row Level Security como mecanismo principal de autorización (ver `docs/02-data-model.md`).
- **Vercel** para despliegue.
- **Tailwind CSS** + `shadcn/ui` como base de componentes, pero personalizado — ver `DESIGN.md`. No usar los estilos por defecto de shadcn sin ajustar tokens.
- Idioma de la interfaz: **español** (los usuarios son jugadores y directivos del club). Identificadores de código (variables, funciones, tipos): **inglés**, como es convención. **Excepción deliberada:** los nombres de tablas/columnas de la base de datos están en **español** porque reflejan el dominio de negocio tal como el club y este documento lo discuten (`eventos_cobro`, `comprobantes`, etc.) — mantener esa consistencia entre docs, conversación con el club y esquema, en vez de traducir y crear dos vocabularios paralelos.

## Principios de producto (no negociables)

Estos vinieron de conversaciones directas con los dos fundadores del proyecto — no son preferencias estéticas, son requisitos:

1. **Pocos clics, sin sobrecarga de menú.** Nada de "500 pestañas". Cualquier acción primaria (subir comprobante, aprobar comprobante, crear evento de cobro) debe estar a ≤2 clics desde la pantalla de inicio del rol correspondiente.
2. **La pantalla de inicio es accionable, no un dashboard estático.** Nada de tarjetas de KPI que no cambian el comportamiento de nadie. Cada rol ve, apenas entra, lo que necesita *hacer* hoy — ver `docs/04-ux-ia.md` para el diseño exacto por rol.
3. **El motor de reglas de conciliación es el producto.** No es un detalle de implementación — es lo que hace que esto sea mejor que un Excel. Ver `docs/03-reconciliation-engine.md` antes de tocar cualquier lógica de aplicación de pagos. Nunca hardcodear FIFO ni ninguna otra regla fija.
4. **Multi-rol es real desde el lanzamiento**, no un caso futuro. Una persona puede ser jugador y tesorero a la vez, por ejemplo. El cambio de rol se resuelve con un selector limpio (pestañas/segmented control), nunca duplicando la navegación.
5. **La bitácora de actividad no debe crecer sin control.** Registrar eventos de negocio significativos (pagos, cambios de estado, eventos de cobro), nunca vistas/lecturas. Ver `docs/02-data-model.md` y `docs/04-ux-ia.md`.

## Roles

- **Administrador**: crea/edita eventos de cobro, carga jugadores (Excel), gestiona estado de jugadores (activo/lesionado/retirado) con prorrateo.
- **Tesorero**: revisa y aprueba/rechaza comprobantes, configura las reglas de conciliación (solo el tesorero — el admin no edita esta configuración), hace la conciliación bancaria mensual, ve progreso por evento y por jugador.
- **Jugador**: ve su estado de cuenta, sube comprobantes.

Un mismo usuario puede tener más de uno de estos roles simultáneamente (ver `docs/02-data-model.md`: `miembros.roles` es un arreglo).

## Fuera de alcance para v1 (web)

- OCR de comprobantes.
- Bot de WhatsApp (recordatorios + envío de comprobantes) — **fase siguiente, ya planeada**, no descartada. El modelo de datos de `comprobantes` ya incluye un campo `canal` para no tener que migrar cuando esto llegue.
- Pasarela de pago (Wompi u otra) para cobro con tarjeta/Nequi/PSE — considerada, no confirmada. Si se agrega, es un canal adicional de `comprobantes`/`pagos`, no un rediseño.
- Multi-club con autoservicio de registro (el modelo de datos ya lo soporta vía `club_id`; el flujo de alta de un nuevo club no se construye todavía).
- Planes de pago en cuotas explícitos y exportación a Excel (evaluar en fase posterior).

## Estructura de documentos

- `DESIGN.md` — lineamientos visuales concretos. Léelo antes de cualquier trabajo de UI.
- `docs/01-product-brief.md` — problema, usuarios, alcance.
- `docs/02-data-model.md` — esquema completo (Postgres/Supabase), incluye RLS.
- `docs/03-reconciliation-engine.md` — diseño del motor de reglas de conciliación.
- `docs/04-ux-ia.md` — navegación, pantallas de inicio por rol, bitácora.
- `docs/05-implementation-plan.md` — plan por fases.
- `design-references/` — capturas y mockups (Muse u otros) que el club vaya subiendo como referencia visual. Revisa esta carpeta antes de construir una pantalla nueva; puede tener contenido más reciente que este documento.

## Qué hacer si algo no está claro

Los fundadores de este proyecto prefieren que preguntes antes de asumir en decisiones de UX/UI o de arquitectura con impacto grande, en vez de rellenar el vacío con una suposición. Si un documento no cubre el caso que estás implementando, dilo explícitamente y pregunta en vez de improvisar silenciosamente.
