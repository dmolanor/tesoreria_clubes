# Raza Ultimate — Tesorería

Plataforma web para gestionar cobros, pagos y conciliación financiera del club de Ultimate Frisbee Raza Ultimate (categorías Élite y Junior). Pensada para que, en el futuro, otros clubes puedan usarla sin mezclar sus datos.

**Estado actual:** fase de planeación / diseño. Aún no hay código de aplicación — este repo contiene los documentos de contexto y el plan de implementación que guiarán el desarrollo con Claude Code.

## Empezar aquí

1. [`CLAUDE.md`](./CLAUDE.md) — contexto del proyecto para cualquier sesión de Claude Code (léelo primero, siempre).
2. [`DESIGN.md`](./DESIGN.md) — lineamientos de diseño visual (paleta, tipografía, componentes) para evitar una UI genérica de IA.
3. [`docs/01-product-brief.md`](./docs/01-product-brief.md) — el problema, los usuarios, qué entra y qué no en v1.
4. [`docs/02-data-model.md`](./docs/02-data-model.md) — esquema de base de datos (Supabase/Postgres).
5. [`docs/03-reconciliation-engine.md`](./docs/03-reconciliation-engine.md) — el motor de reglas de conciliación (el diferenciador central del producto).
6. [`docs/04-ux-ia.md`](./docs/04-ux-ia.md) — navegación, pantallas de inicio por rol, bitácora de actividad.
7. [`docs/05-implementation-plan.md`](./docs/05-implementation-plan.md) — plan de implementación por fases.

## Stack

- **Frontend + backend:** Next.js (App Router), TypeScript, Tailwind CSS.
- **Base de datos, auth y storage:** Supabase (Postgres, Supabase Auth, Storage para comprobantes).
- **Despliegue:** Vercel.
- **Referencias de diseño:** capturas y mockups en [`design-references/`](./design-references/).

## Wireframes de exploración

Primer wireframe de baja fidelidad (panel Administrativo y Tesorero) hecho antes de este repo: https://claude.ai/artifact/6Yxe4nGbzYjpLzZ3bjrhru — usar como referencia de estructura e información, no como guía visual final (ver `DESIGN.md`).
