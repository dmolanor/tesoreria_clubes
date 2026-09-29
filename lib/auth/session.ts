import "server-only"
import { cookies } from "next/headers"
import { getStore } from "@/lib/data"
import type { Rol, Usuario } from "@/lib/data/types"
import { DEMO_IDS } from "@/lib/data/seed"
import type { Ctx } from "@/lib/domain/ledger"

// Sustituto del login mientras no hay Supabase Auth. Hoy la identidad sale de
// una cookie que se cambia con "Actuar como…"; mañana `getSession` leerá
// `auth.uid()` y el resto de la app no cambia. Los roles SIEMPRE se resuelven
// contra `roles_usuario` (nunca contra algo embebido en la cookie), igual que RLS.

export const DEV_USER_COOKIE = "dev_user_id"
export const ROL_COOKIE = "rol_activo"

export const AUTH_MODE = process.env.AUTH_MODE ?? "dev"

export const ROL_HOME: Record<Rol, string> = {
  jugador: "/jugador",
  tesorero: "/tesorero",
  administrativo: "/admin",
}

export const ROL_LABEL: Record<Rol, string> = {
  jugador: "Jugador",
  tesorero: "Tesorero",
  administrativo: "Administrador",
}

export interface Session {
  usuario: Usuario
  club_id: string
  roles: Rol[]
  rolActivo: Rol
}

export class ForbiddenError extends Error {}

export async function getSession(): Promise<Session> {
  if (AUTH_MODE !== "dev") throw new Error(`AUTH_MODE=${AUTH_MODE} aún no está implementado`)
  const jar = await cookies()
  const db = await getStore().read()
  const userId = jar.get(DEV_USER_COOKIE)?.value ?? DEMO_IDS.tesorera
  const usuario = db.usuarios.find((u) => u.id === userId) ?? db.usuarios.find((u) => u.id === DEMO_IDS.tesorera)!
  const orden: Rol[] = ["tesorero", "administrativo", "jugador"]
  const roles = orden.filter((rol) =>
    db.roles_usuario.some((r) => r.usuario_id === usuario.id && r.club_id === usuario.club_id && r.rol === rol && r.activo),
  )
  const pedido = jar.get(ROL_COOKIE)?.value as Rol | undefined
  const rolActivo = pedido && roles.includes(pedido) ? pedido : roles[0]
  return { usuario, club_id: usuario.club_id, roles, rolActivo }
}

/** Autorización para server actions y páginas: la persona debe tener alguno de los roles. */
export async function requireRole(...permitidos: Rol[]): Promise<Session> {
  const s = await getSession()
  if (!permitidos.some((r) => s.roles.includes(r))) {
    throw new ForbiddenError(`Esta acción requiere el rol ${permitidos.map((r) => ROL_LABEL[r]).join(" o ")}`)
  }
  return s
}

export function ctxFrom(s: Session): Ctx {
  return { club_id: s.club_id, actor_id: s.usuario.id, now: new Date().toISOString(), newId: () => crypto.randomUUID() }
}
