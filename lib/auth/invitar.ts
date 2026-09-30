import "server-only"
import { headers } from "next/headers"
import { createAdminClient } from "@/lib/supabase/admin"
import { DomainError } from "@/lib/action-result"
import { esCorreoDemo, esCuentaExistente } from "@/lib/invitaciones"

/** Sitio desde donde llegó la petición (localhost, ngrok o Vercel): ahí vuelven los enlaces del correo. */
export async function origenDeLaPeticion(): Promise<string> {
  const h = await headers()
  return h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`
}

export type ResultadoInvitacion = "enviada" | "ya_tenia_cuenta" | "demo"

/**
 * Invita un correo a Supabase Auth. Quien llama ya verificó el rol administrativo y creó la fila
 * en `miembros`. Al crearse la cuenta, el trigger `vincular_miembros` enlaza esa fila por correo.
 * Si el correo ya tenía cuenta (p. ej. es miembro de otro club), el trigger no se dispara y el
 * vínculo se hace aquí.
 */
export async function invitarCorreo(clubId: string, correo: string, origen: string): Promise<ResultadoInvitacion> {
  if (esCorreoDemo(correo)) return "demo"
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.inviteUserByEmail(correo, { redirectTo: `${origen}/auth/confirm` })
  if (!error) return "enviada"
  if (error.status === 429 || error.code === "over_email_send_rate_limit") {
    throw new DomainError("Se alcanzó el límite de correos por hora. Intenta de nuevo más tarde")
  }
  if (!esCuentaExistente(error)) throw error

  // generateLink devuelve el usuario existente sin mandar ningún correo.
  const { data, error: e2 } = await admin.auth.admin.generateLink({ type: "magiclink", email: correo })
  if (e2) throw e2
  const { error: e3 } = await admin
    .from("miembros")
    .update({ auth_user_id: data.user.id })
    .eq("club_id", clubId)
    .eq("correo", correo)
    .is("auth_user_id", null)
  if (e3) throw e3
  return "ya_tenia_cuenta"
}
