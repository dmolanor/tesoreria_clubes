import "server-only"
import { redirect } from "next/navigation"
import { getSession, ROL_HOME, type Session } from "./session"
import type { Rol } from "@/lib/db/types"

/** Para páginas: si la persona no tiene ninguno de los roles, la devuelve a su inicio. */
export async function pageSession(...permitidos: Rol[]): Promise<Session> {
  const s = await getSession()
  if (!permitidos.some((r) => s.roles.includes(r))) redirect(ROL_HOME[s.rolActivo])
  return s
}
