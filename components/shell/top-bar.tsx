import Link from "next/link"
import { LogOut } from "lucide-react"
import { DEMO_MODE, ROL_HOME, type Session } from "@/lib/auth/session"
import { conteoPendientes } from "@/lib/db/tesoreria"
import { createAdminClient } from "@/lib/supabase/admin"
import { salir } from "@/app/actions/session"
import { NavTabs, type NavItem } from "./nav-tabs"
import { RoleSwitcher } from "./role-switcher"
import { DemoSwitcher, type DemoUser } from "./demo-switcher"

const ROL_CORTO = { tesorero: "tesorero", administrativo: "admin", jugador: "jugador" } as const

/** Solo DEMO_MODE: cuentas demo (@example.com) para "Actuar como…". Usa la secret key, solo en servidor. */
async function cuentasDemo(clubId: string): Promise<{ destacados: DemoUser[]; resto: DemoUser[] }> {
  const { data } = await createAdminClient()
    .from("miembros")
    .select("id, nombre, categoria, roles")
    .eq("club_id", clubId)
    .like("correo", "%@example.com")
    .neq("estado", "retirado")
    .order("nombre")
  const destacados: DemoUser[] = []
  const resto: DemoUser[] = []
  for (const m of data ?? []) {
    const u = { id: m.id, nombre: m.nombre, etiqueta: m.roles.map((r) => ROL_CORTO[r]).join(" + ") }
    if (m.roles.some((r) => r !== "jugador")) destacados.push(u)
    else resto.push({ ...u, etiqueta: m.categoria ?? "jugador" })
  }
  return { destacados, resto }
}

export async function TopBar({ session }: { session: Session }) {
  const pendientes = session.roles.includes("tesorero") ? await conteoPendientes(session.supabase, session.club_id) : 0

  const nav: Record<Session["rolActivo"], NavItem[]> = {
    jugador: [{ href: "/jugador", label: "Inicio" }],
    tesorero: [
      { href: "/tesorero", label: "Inicio" },
      { href: "/tesorero/conciliacion", label: "Conciliación" },
      { href: "/tesorero/mora", label: "Mora" },
      { href: "/tesorero/comprobantes", label: "Comprobantes", badge: pendientes },
      { href: "/tesorero/reglas", label: "Reglas de conciliación", icon: "settings" },
    ],
    administrativo: [
      { href: "/admin", label: "Inicio" },
      { href: "/eventos", label: "Eventos de cobro" },
      { href: "/jugadores", label: "Jugadores" },
    ],
  }

  const demo = DEMO_MODE ? await cuentasDemo(session.club_id) : null

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 pt-3">
        <Link href={ROL_HOME[session.rolActivo]} className="mr-auto leading-tight focus-visible:ring-2 focus-visible:ring-raza focus-visible:outline-none">
          <span className="block text-[15px] font-bold">{session.clubNombre}</span>
          <span className="block text-[13px] text-muted-foreground">{session.usuario.nombre}</span>
        </Link>
        <RoleSwitcher roles={session.roles} activo={session.rolActivo} />
        {demo ? <DemoSwitcher users={demo} currentId={session.usuario.id} /> : null}
        <form action={salir}>
          <button
            type="submit"
            aria-label="Salir"
            title="Salir"
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-raza focus-visible:outline-none"
          >
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
      <div className="mx-auto max-w-5xl px-2 pt-1">
        <NavTabs items={nav[session.rolActivo]} />
      </div>
    </header>
  )
}
