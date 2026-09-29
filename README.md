# Raza Ultimate — Tesorería

Plataforma web para gestionar cobros, pagos y conciliación financiera del club de Ultimate Frisbee Raza Ultimate (categorías Élite y Junior). Pensada para que, en el futuro, otros clubes puedan usarla sin mezclar sus datos.

**Estado actual:** prototipo funcional local con datos mock (sin Supabase ni Vercel todavía). Los tres roles, el motor de conciliación, la conciliación mensual y la bitácora funcionan sobre un archivo JSON local.

## Correr el prototipo

```bash
npm install
npm run seed      # genera .data/db.json con ~48 jugadores y el historial jul–sep 2026
npm run dev       # http://localhost:3000
```

- **Sin login:** usa el selector **"Actuar como…"** de la barra superior. Laura Gómez es tesorera + jugadora (multi-rol), Andrés Molina es administrador, Diego Rincón es administrador + jugador.
- **Reiniciar datos:** `npm run seed` o el botón en `/dev`.
- **Tests del motor de conciliación:** `npm test`. También `npm run typecheck` y `npm run lint`.

### Compartir con ngrok

Una sola vez: `ngrok config add-authtoken <token>` (token en dashboard.ngrok.com).

```bash
npm run share        # build de producción + ngrok (estable)
npm run share:dev    # next dev + ngrok (recarga en caliente)
```

El script imprime usuario y clave (autenticación básica en ngrok; sin ella, cualquiera con la URL podría "actuar como" la tesorera). Opcional: `SHARE_PASSWORD=...` para fijar la clave y `NGROK_DOMAIN=tu-dominio.ngrok-free.app` para usar tu dominio estático gratuito. Detén `npm run dev` antes (usan el mismo puerto).

### Supabase

El esquema definitivo ya está en Supabase (proyecto "Tesoreria Clubes Ultimate"); la app todavía corre sobre el JSON local hasta el siguiente plan.

- `supabase/migrations/` — fuente de verdad del esquema (9 tablas, RLS, triggers, funciones, Storage). Explicación en `docs/02-data-model.md`.
- `supabase/tests/rls.sql` — 46 pruebas de RLS e invariantes; se ejecutan como postgres y se revierten solas (terminan con `RLS_OK …`).
- `supabase/seed.sql` — datos demo generados con `npm run seed:sql` (mismo historial que el JSON).
- `npm run seed:supabase` — carga el seed en Supabase. Requiere `SUPABASE_DB_URL` en `.env.local` (Dashboard → Connect → Session pooler).
- `lib/data/database.types.ts` — tipos generados; regenerar después de cada migración.

### Estructura

- `lib/engine/` — motor de reglas de conciliación (función pura + tests). El núcleo del producto.
- `lib/domain/ledger.ts` — lógica de negocio pura (aceptar/rechazar, eventos, saldo a favor, prorrateo, reglas, conciliación).
- `lib/data/` — tipos del esquema (1:1 con `docs/02-data-model.md`), interfaz `Store` y su implementación JSON. Para pasar a Supabase se implementa `Store` otra vez; dominio y UI no cambian.
- `lib/auth/session.ts` — `getSession()` / `requireRole()`: hoy cookie dev, mañana Supabase Auth. Toda server action pasa por `requireRole` (el sustituto de RLS mientras no hay Postgres).
- `app/actions/` — server actions por área. `app/{jugador,tesorero,admin}` — inicio y vistas de cada rol; `app/eventos`, `app/jugadores` — vistas compartidas admin/tesorero.

### Decisiones provisionales (marcadas `TODO(club)` en el código)

- **Prorrateo** al pasar a lesionado/retirado: proporcional a los días activos del mes, con piso del 50% de la mensualidad. Falta confirmar la fórmula y el monto mínimo con la tesorera.
- **Mensualidades** se reconocen por el nombre ("Mensualidad…"). Conviene agregar un tipo de evento al modelo.
- **Cancelar un evento** con pagos: lo pagado pasa a saldo a favor del jugador.
- **Lesionados/retirados** no reciben obligaciones de eventos nuevos.
- **Conciliación mensual** suma los comprobantes aceptados según su fecha de carga (hora de Colombia).

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
