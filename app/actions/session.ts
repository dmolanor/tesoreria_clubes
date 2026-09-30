"use server"

import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { DEMO_MODE, ROL_COOKIE, ROL_HOME, getSession } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { origenDeLaPeticion } from "@/lib/auth/invitar"
import { correoValido, esCorreoSinCuenta, normalizarCorreo } from "@/lib/invitaciones"
import type { ActionResult } from "@/lib/action-result"
import type { Rol } from "@/lib/db/types"

const COOKIE_OPTS = { path: "/", httpOnly: true, sameSite: "lax" as const, maxAge: 60 * 60 * 24 * 30 }
// Recuerda que ya se escribió la clave demo, para cambiar de cuenta sin volver a pedirla.
// Firmada (HMAC con DEMO_PASSWORD) y con vencimiento: no se puede falsificar.
const DEMO_COOKIE = "demo_ok"
const DEMO_TTL_S = 60 * 60 * 8

function firma(exp: string) {
  return createHmac("sha256", process.env.DEMO_PASSWORD ?? "").update(`demo:${exp}`).digest("base64url")
}

function demoCookieValida(valor: string | undefined) {
  const [exp, sig] = (valor ?? "").split(".")
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false
  const a = Buffer.from(sig)
  const b = Buffer.from(firma(exp))
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Selector de rol: cambia el contexto completo (navegación + inicio). */
export async function cambiarRol(rol: Rol) {
  const s = await getSession()
  if (!s.roles.includes(rol)) throw new Error("No tienes ese rol")
  ;(await cookies()).set(ROL_COOKIE, rol, COOKIE_OPTS)
  redirect(ROL_HOME[rol])
}

/** Magic link, solo para correos que ya tienen cuenta (la administración los invita). /auth/confirm canjea el enlace. */
export async function enviarEnlace(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const correo = normalizarCorreo(String(formData.get("correo") ?? ""))
  if (!correoValido(correo)) return { ok: false, error: "Escribe un correo válido" }
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: correo,
    options: { emailRedirectTo: `${await origenDeLaPeticion()}/auth/confirm`, shouldCreateUser: false },
  })
  if (error) {
    if (esCorreoSinCuenta(error)) return { ok: false, error: "Ese correo no tiene invitación. Pídesela a la administración del club" }
    return { ok: false, error: error.status === 429 ? "Se enviaron demasiados enlaces. Espera unos minutos." : error.message }
  }
  return { ok: true, message: `Te enviamos un enlace a ${correo}. Ábrelo desde este u otro dispositivo.` }
}

async function entrarDemo(correo: string, password: string) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email: correo, password })
  return error
}

/** Solo DEMO_MODE: entra como una cuenta demo con la clave compartida. */
export async function entrarComoDemo(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!DEMO_MODE) return { ok: false, error: "El modo demo está apagado" }
  const correo = String(formData.get("correo") ?? "")
  const error = await entrarDemo(correo, String(formData.get("clave") ?? ""))
  if (error) return { ok: false, error: "Clave demo incorrecta" }
  const jar = await cookies()
  const exp = String(Math.floor(Date.now() / 1000) + DEMO_TTL_S)
  jar.set(DEMO_COOKIE, `${exp}.${firma(exp)}`, { ...COOKIE_OPTS, maxAge: DEMO_TTL_S })
  jar.delete(ROL_COOKIE)
  redirect("/")
}

/** Solo DEMO_MODE: "Actuar como…" de la barra superior (sin volver a pedir la clave durante 8 h). */
export async function cambiarCuentaDemo(formData: FormData) {
  if (!DEMO_MODE) throw new Error("El modo demo está apagado")
  const jar = await cookies()
  if (!demoCookieValida(jar.get(DEMO_COOKIE)?.value)) redirect("/login")
  const miembroId = String(formData.get("miembro_id"))
  const { data } = await createAdminClient().from("miembros").select("correo").eq("id", miembroId).single()
  if (!data || !data.correo.endsWith("@example.com")) throw new Error("Solo se puede cambiar a cuentas demo")
  const supabase = await createClient()
  await supabase.auth.signOut()
  const error = await entrarDemo(data.correo, process.env.DEMO_PASSWORD ?? "")
  if (error) redirect("/login")
  jar.delete(ROL_COOKIE)
  redirect("/")
}

export async function salir() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const jar = await cookies()
  jar.delete(ROL_COOKIE)
  jar.delete(DEMO_COOKIE)
  redirect("/login")
}
