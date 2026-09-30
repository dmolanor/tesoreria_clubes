# Raza Ultimate — Tesorería

Plataforma web para gestionar cobros, pagos y conciliación financiera del club de Ultimate Frisbee Raza Ultimate (categorías Élite y Junior). Pensada para que, en el futuro, otros clubes puedan usarla sin mezclar sus datos.

**Estado actual:** la app corre sobre Supabase (Postgres con RLS, Storage y Auth por magic link), con un modo demo para probar los tres roles. Lista para desplegar en Vercel.

## Correr en local

Requisitos: Node 22 (`.node-version`; con fnm basta `fnm use`) y las variables de `.env.example` en `.env` / `.env.local`.

```bash
npm install
npm run dev       # http://localhost:3000
```

- **Entrar:** con tu correo (magic link) o, si `DEMO_MODE=on`, en "Modo demo" eligiendo una cuenta y escribiendo `DEMO_PASSWORD`. Laura Gómez es tesorera + jugadora, Andrés Molina administrador, Diego Rincón administrador + jugador. Dentro de la app, el selector **Demo** cambia de cuenta sin volver a pedir la clave (8 h).
- **Reiniciar los datos demo:** `npm run seed:supabase` (requiere `SUPABASE_DB_URL`). Recarga `supabase/seed.sql` y vuelve a vincular las cuentas demo.
- **Tests:** `npm test` (motor de conciliación), `npm run typecheck`, `npm run lint`. Las pruebas de RLS están en `supabase/tests/rls.sql`.

### Configuración de Supabase Auth (una vez, en el Dashboard)

1. **Authentication → URL Configuration.**
   - **Site URL:** la URL de producción (Vercel).
   - **Redirect URLs:** `http://localhost:3000/**`, `https://*.ngrok-free.app/**` y el dominio de Vercel (`https://<proyecto>.vercel.app/**`).
2. **Authentication → Email Templates → Magic Link.** Cambia el enlace a:
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
   Así el enlace funciona aunque el jugador abra el correo en el celular (otro navegador). Sin este cambio solo funciona en el mismo navegador donde se pidió.
3. **Antes de invitar a los ~50 jugadores:** Authentication → SMTP Settings con un proveedor propio (Resend, gratis hasta 3.000/mes; requiere un dominio). El correo por defecto de Supabase solo permite unos pocos envíos por hora.

### Desplegar en Vercel

1. Importa el repo y elige el preset **Next.js**.
2. Variables de entorno: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `DEMO_MODE`, `DEMO_PASSWORD`.
3. Agrega el dominio de Vercel en las Redirect URLs de Supabase (paso 1 de arriba).
4. Cuando entren los jugadores reales: `DEMO_MODE=off`.

### Compartir por ngrok

`npm run share` (build + ngrok con usuario y clave; ver `scripts/share.sh`). Agrega la URL de ngrok a las Redirect URLs de Supabase si vas a probar el magic link por ahí.

### Supabase

- `supabase/migrations/` — fuente de verdad del esquema (9 tablas, RLS, triggers, funciones, Storage). Explicación en `docs/02-data-model.md`.
- `supabase/tests/rls.sql` — 46 pruebas de RLS e invariantes; se ejecutan como postgres y se revierten solas (terminan con `RLS_OK …`).
- `supabase/seed.sql` — datos demo, generados con `npm run seed:sql` desde `scripts/demo/` (historial jul–sep 2026).
- `lib/data/database.types.ts` — tipos generados; regenerar después de cada migración.

### Estructura

- `lib/engine/` — motor de reglas de conciliación (función pura + tests). Propone; la base valida y escribe.
- `lib/supabase/` — clientes: `server.ts` (sesión del usuario, RLS), `proxy.ts` (refresco de sesión, usado por `proxy.ts` en la raíz), `admin.ts` (secret key, solo modo demo).
- `lib/auth/session.ts` — `getSession()` / `requireRole()`: sesión de Supabase + roles leídos de `miembros`.
- `lib/db/` — lecturas tipadas (estado de cuenta, bandeja con propuesta del motor, mora, eventos, bitácora).
- `app/actions/` — server actions: RPCs de la base para escrituras de varias filas, escrituras directas bajo RLS para el resto.
- `app/(app)/` — pantallas con sesión (jugador, tesorero, admin); `app/login`, `app/auth/confirm`, `app/sin-acceso` son públicas.
- `scripts/demo/` — generador del historial demo (solo produce `supabase/seed.sql`; la app no lo importa).

### Decisiones provisionales (marcadas `TODO(club)` en el código)

- **Prorrateo** al pasar a lesionado/retirado: proporcional a los días activos del mes, con piso del 50% de la mensualidad. Falta confirmar la fórmula y el monto mínimo con la tesorera.
- **Cancelar un evento** con pagos: lo pagado pasa a saldo a favor del jugador.
- **Lesionados/retirados** no reciben obligaciones de eventos nuevos.
- **Conciliación mensual** suma los comprobantes aceptados según su fecha de pago (la que indica el jugador al subirlo).

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
