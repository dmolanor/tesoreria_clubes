"use server"

import { requireRole } from "@/lib/auth/session"
import { check, runAction, DomainError, type ActionResult } from "@/lib/action-result"
import { bandeja, lineasRpc } from "@/lib/db/tesoreria"
import { formatCOP, hoyISO, parseMonto } from "@/lib/format"

const TIPOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
}
const MAX_BYTES = 8 * 1024 * 1024

/** Jugador: sube el comprobante (archivo a Storage + fila) por el monto total, sin elegir evento. */
export async function subirComprobanteAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("jugador")
    const monto = parseMonto(formData.get("monto"))
    if (monto <= 0) throw new DomainError("Escribe el monto que transferiste")
    const fecha = String(formData.get("fecha_pago") || hoyISO())
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha > hoyISO()) throw new DomainError("La fecha de la transferencia no es válida")
    const archivo = formData.get("archivo")
    if (!(archivo instanceof File) || archivo.size === 0) throw new DomainError("Adjunta la foto o PDF del comprobante")
    const ext = TIPOS[archivo.type]
    if (!ext) throw new DomainError("Sube una imagen (JPG, PNG, WEBP, HEIC) o un PDF")
    if (archivo.size > MAX_BYTES) throw new DomainError("El archivo pesa más de 8 MB")

    // Ruta que exige la política de Storage: {club}/{miembro}/{archivo}
    const path = `${s.club_id}/${s.usuario.id}/${crypto.randomUUID()}.${ext}`
    check(await s.supabase.storage.from("comprobantes").upload(path, archivo, { contentType: archivo.type }))
    check(
      await s.supabase.from("comprobantes").insert({
        club_id: s.club_id,
        miembro_id: s.usuario.id,
        monto,
        fecha_pago: fecha,
        archivo_path: path,
      }),
    )
    return `Comprobante de ${formatCOP(monto)} enviado. La tesorería lo revisará.`
  })
}

/** Tesorero: acepta tal cual la propuesta del motor (1 clic desde la bandeja). */
export async function aceptarPropuestaAction(comprobanteId: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("tesorero")
    const [c] = await bandeja(s.supabase, s.club_id, { id: comprobanteId })
    if (!c) throw new DomainError("Este comprobante ya fue revisado")
    check(await s.supabase.rpc("aceptar_comprobante", { p_comprobante_id: c.id, p_lineas: lineasRpc(c.propuesta.lineas) }))
    return "Comprobante aceptado"
  })
}

/**
 * Tesorero: acepta con el desglose editado (campos `monto:<obligacion_id>`). Si el monto coincide
 * con lo propuesto se conserva la regla de origen; si no, la línea queda como ajuste manual.
 */
export async function aceptarConDesgloseAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("tesorero")
    const [c] = await bandeja(s.supabase, s.club_id, { id: String(formData.get("comprobante_id")) })
    if (!c) throw new DomainError("Este comprobante ya fue revisado")
    const lineas = []
    for (const [key, value] of formData.entries()) {
      if (!key.startsWith("monto:")) continue
      const obligacion_id = key.slice("monto:".length)
      const monto = parseMonto(value)
      if (monto <= 0) continue
      const propuestas = c.propuesta.lineas.filter((l) => l.obligacion_id === obligacion_id)
      const igual = propuestas.reduce((sum, l) => sum + l.monto_aplicado, 0) === monto
      lineas.push({
        obligacion_id,
        monto_aplicado: monto,
        regla_aplicada: igual ? (propuestas[0]?.regla_aplicada ?? null) : null,
        manual: !igual,
      })
    }
    check(await s.supabase.rpc("aceptar_comprobante", { p_comprobante_id: c.id, p_lineas: lineasRpc(lineas) }))
    return "Comprobante aceptado con el desglose editado"
  })
}

export async function rechazarAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("tesorero")
    const motivo = String(formData.get("motivo") ?? "").trim()
    if (!motivo) throw new DomainError("Escribe el motivo del rechazo — el jugador lo verá")
    const filas = check(
      await s.supabase
        .from("comprobantes")
        .update({ estado: "rechazado", motivo_rechazo: motivo })
        .eq("id", String(formData.get("comprobante_id")))
        .eq("estado", "pendiente")
        .select("id"),
    )
    if (!filas?.length) throw new DomainError("Este comprobante ya fue revisado")
    return "Comprobante rechazado — el jugador verá el motivo"
  })
}
