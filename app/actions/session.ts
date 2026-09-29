"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { AUTH_MODE, DEV_USER_COOKIE, ROL_COOKIE, ROL_HOME, getSession } from "@/lib/auth/session"
import type { Rol } from "@/lib/data/types"

const COOKIE_OPTS = { path: "/", httpOnly: true, sameSite: "lax" as const, maxAge: 60 * 60 * 24 * 30 }

/** Solo en AUTH_MODE=dev: cambia la identidad simulada. */
export async function actuarComo(formData: FormData) {
  if (AUTH_MODE !== "dev") throw new Error("Solo disponible en modo dev")
  const jar = await cookies()
  jar.set(DEV_USER_COOKIE, String(formData.get("usuario_id")), COOKIE_OPTS)
  jar.delete(ROL_COOKIE)
  const s = await getSession()
  redirect(ROL_HOME[s.rolActivo])
}

/** Selector de rol: cambia el contexto completo (navegación + inicio). Recuerda el último rol usado. */
export async function cambiarRol(rol: Rol) {
  const s = await getSession()
  if (!s.roles.includes(rol)) throw new Error("No tienes ese rol")
  ;(await cookies()).set(ROL_COOKIE, rol, COOKIE_OPTS)
  redirect(ROL_HOME[rol])
}
