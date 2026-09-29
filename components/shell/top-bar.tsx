import Link from "next/link"
import { getStore } from "@/lib/data"
import { AUTH_MODE, ROL_HOME, type Session } from "@/lib/auth/session"
import { estadoCuenta, jugadoresDelClub } from "@/lib/domain/ledger"
import { ESTADO_LABEL } from "@/components/status-dot"
import { hoyISO } from "@/lib/format"
import { NavTabs, type NavItem } from "./nav-tabs"
import { RoleSwitcher } from "./role-switcher"
import { DevUserPicker, type DevUser } from "./dev-user-picker"

export async function TopBar({ session }: { session: Session }) {
  const db = await getStore().read()
  const club = db.clubes.find((c) => c.id === session.club_id)

  const pendientes = db.comprobantes.filter(
    (c) => c.estado === "pendiente" && db.usuarios.find((u) => u.id === c.usuario_id)?.club_id === session.club_id,
  ).length

  const nav: Record<Session["rolActivo"], NavItem[]> = {
    jugador: [{ href: "/jugador", label: "Inicio" }],
    tesorero: [
      { href: "/tesorero", label: "Inicio" },
      { href: "/tesorero/comprobantes", label: "Comprobantes", badge: pendientes },
      { href: "/tesorero/conciliacion", label: "Conciliación" },
      { href: "/tesorero/mora", label: "Mora" },
      { href: "/tesorero/reglas", label: "Reglas de conciliación", icon: "settings" },
    ],
    administrativo: [
      { href: "/admin", label: "Inicio" },
      { href: "/eventos", label: "Eventos de cobro" },
      { href: "/jugadores", label: "Jugadores" },
    ],
  }

  let devUsers: { destacados: DevUser[]; resto: DevUser[] } | null = null
  if (AUTH_MODE === "dev") {
    const hoy = hoyISO()
    const rolesDe = (id: string) =>
      db.roles_usuario.filter((r) => r.usuario_id === id && r.activo).map((r) => r.rol)
    const destacados: DevUser[] = []
    const resto: DevUser[] = []
    for (const u of db.usuarios.filter((u) => u.club_id === session.club_id)) {
      const roles = rolesDe(u.id)
      if (roles.some((r) => r !== "jugador")) {
        destacados.push({ id: u.id, nombre: u.nombre, etiqueta: roles.join(" + ") })
      }
    }
    for (const u of jugadoresDelClub(db, session.club_id).sort((a, b) => a.nombre.localeCompare(b.nombre))) {
      if (destacados.some((d) => d.id === u.id)) continue
      const estado = u.estado === "activo" ? ESTADO_LABEL[estadoCuenta(db, u.id, hoy).estado].toLowerCase() : u.estado
      resto.push({ id: u.id, nombre: u.nombre, etiqueta: `${u.categoria ?? ""} · ${estado}` })
    }
    devUsers = { destacados, resto }
  }

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 pt-3">
        <Link href={ROL_HOME[session.rolActivo]} className="mr-auto leading-tight focus-visible:ring-2 focus-visible:ring-raza focus-visible:outline-none">
          <span className="block text-[15px] font-bold">{club?.nombre ?? "Club"}</span>
          <span className="block text-[13px] text-muted-foreground">{session.usuario.nombre}</span>
        </Link>
        <RoleSwitcher roles={session.roles} activo={session.rolActivo} />
        {devUsers ? <DevUserPicker users={devUsers} currentId={session.usuario.id} /> : null}
      </div>
      <div className="mx-auto max-w-5xl px-2 pt-1">
        <NavTabs items={nav[session.rolActivo]} />
      </div>
    </header>
  )
}
