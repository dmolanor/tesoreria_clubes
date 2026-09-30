import "server-only"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient, type Supabase } from "@/lib/supabase/server"
import type { Miembro, Rol } from "@/lib/db/types"

// Identidad = sesión de Supabase Auth (magic link o cuenta demo). Los roles se leen de
// `miembros.roles` en cada request, igual que RLS: nunca del JWT.

export const ROL_COOKIE = "rol_activo"
export const CLUB_COOKIE = "club_activo"

export const DEMO_MODE = process.env.DEMO_MODE === "on"

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
  supabase: Supabase
  userId: string
  usuario: Miembro // el miembro del usuario en el club activo
  club_id: string
  clubNombre: string
  roles: Rol[]
  rolActivo: Rol
}

export class ForbiddenError extends Error {}

const ORDEN: Rol[] = ["tesorero", "administrativo", "jugador"]

/** Devuelve la sesión o redirige: sin login → /login; sin membresía activa → /sin-acceso. */
export async function getSession(): Promise<Session> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) redirect("/login")

  const { data: miembros, error } = await supabase
    .from("miembros")
    .select("*, clubes(nombre)")
    .eq("auth_user_id", userId)
    .neq("estado", "retirado")
  if (error) throw error
  if (!miembros?.length) redirect("/sin-acceso")

  const jar = await cookies()
  const pedido = jar.get(CLUB_COOKIE)?.value
  const m = miembros.find((x) => x.club_id === pedido) ?? miembros[0]
  const roles = ORDEN.filter((r) => m.roles.includes(r))
  const rolPedido = jar.get(ROL_COOKIE)?.value as Rol | undefined
  const { clubes, ...usuario } = m
  return {
    supabase,
    userId,
    usuario,
    club_id: m.club_id,
    clubNombre: clubes?.nombre ?? "Club",
    roles,
    rolActivo: rolPedido && roles.includes(rolPedido) ? rolPedido : roles[0],
  }
}

/** Para server actions: la persona debe tener alguno de los roles (RLS lo vuelve a verificar). */
export async function requireRole(...permitidos: Rol[]): Promise<Session> {
  const s = await getSession()
  if (!permitidos.some((r) => s.roles.includes(r))) {
    throw new ForbiddenError(`Esta acción requiere el rol ${permitidos.map((r) => ROL_LABEL[r]).join(" o ")}`)
  }
  return s
}
