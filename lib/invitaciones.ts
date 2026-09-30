// Reglas puras de alta e invitación (sin Supabase): se prueban con vitest.

const CORREO_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function normalizarCorreo(raw: string): string {
  return raw.trim().toLowerCase()
}

export function correoValido(correo: string): boolean {
  return CORREO_RE.test(correo)
}

/** Cuentas de los datos demo: nunca se les manda correo (rebotarían y Supabase penaliza los rebotes). */
export function esCorreoDemo(correo: string): boolean {
  return normalizarCorreo(correo).endsWith("@example.com")
}

/**
 * Teléfono a E.164 (lo que exige `miembros.telefono`). Sin indicativo se asume Colombia (+57).
 * Devuelve null si no queda un número válido.
 */
export function normalizarTelefono(raw: string): string | null {
  const limpio = raw.trim().replace(/[\s\-().]/g, "")
  if (!limpio) return null
  let e164: string
  if (limpio.startsWith("+")) e164 = limpio
  else if (limpio.startsWith("00")) e164 = `+${limpio.slice(2)}`
  else if (/^3\d{9}$/.test(limpio) || /^60\d{8}$/.test(limpio)) e164 = `+57${limpio}`
  else if (/^57\d{10}$/.test(limpio)) e164 = `+${limpio}`
  else return null
  return /^\+[1-9][0-9]{7,14}$/.test(e164) ? e164 : null
}

/** Error de Supabase Auth al pedir un enlace con `shouldCreateUser: false` y un correo sin cuenta. */
export function esCorreoSinCuenta(error: { code?: string; message?: string }): boolean {
  return error.code === "otp_disabled" || /signups not allowed/i.test(error.message ?? "")
}

/** Error de Supabase Auth al invitar un correo que ya tiene cuenta. */
export function esCuentaExistente(error: { code?: string; message?: string }): boolean {
  return error.code === "email_exists" || /already (been )?registered/i.test(error.message ?? "")
}
