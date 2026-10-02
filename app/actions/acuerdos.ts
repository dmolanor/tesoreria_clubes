"use server"

import { requireRole } from "@/lib/auth/session"
import { check, runAction, DomainError, type ActionResult } from "@/lib/action-result"
import { formatCOP, parseMonto } from "@/lib/format"

// Mismos formatos y límite que el bucket `comprobantes`, donde vive también la evidencia.
const TIPOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
}
const MAX_BYTES = 8 * 1024 * 1024

interface CuotaForm {
  numero: number
  fecha: string
  monto: number
}

/** Lee cuotas de campos `fecha:1/monto:1…` (el índice es el número de cuota). */
function leerCuotas(formData: FormData): CuotaForm[] {
  const cuotas: CuotaForm[] = []
  for (const [key, value] of formData.entries()) {
    const m = /^fecha:(\d+)$/.exec(key)
    if (!m) continue
    const numero = Number(m[1])
    const fecha = String(value ?? "")
    const monto = parseMonto(formData.get(`monto:${numero}`))
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new DomainError(`La cuota ${numero} necesita una fecha válida`)
    if (monto <= 0) throw new DomainError(`La cuota ${numero} necesita un monto mayor a 0`)
    cuotas.push({ numero, fecha, monto })
  }
  cuotas.sort((a, b) => a.numero - b.numero)
  if (!cuotas.length) throw new DomainError("Agrega al menos una cuota con fecha y monto")
  return cuotas.map((c, i) => ({ ...c, numero: i + 1 }))
}

export async function crearAcuerdoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("tesorero")
    const obligacion_id = String(formData.get("obligacion_id") ?? "")
    const { data: obl, error } = await s.supabase
      .from("obligaciones")
      .select("id, club_id, miembro_id, monto, pagado, eventos_cobro(nombre)")
      .eq("id", obligacion_id)
      .eq("club_id", s.club_id)
      .maybeSingle()
    if (error) throw error
    if (!obl) throw new DomainError("Elige la deuda que cubre el acuerdo")
    const cuotas = leerCuotas(formData)
    const existente = check(
      await s.supabase.from("acuerdos_pago").select("id").eq("obligacion_id", obligacion_id).eq("estado", "activo").maybeSingle(),
    )
    if (existente) throw new DomainError("Esta deuda ya tiene un acuerdo activo. Cancélalo antes de crear otro")
    const notas = String(formData.get("notas") ?? "").trim() || null

    const archivo = formData.get("evidencia")
    if (!(archivo instanceof File) || archivo.size === 0) {
      throw new DomainError("Adjunta la captura del mensaje o documento donde el jugador aceptó las condiciones")
    }
    const ext = TIPOS[archivo.type]
    if (!ext) throw new DomainError("La evidencia debe ser una imagen (JPG, PNG, WEBP, HEIC) o un PDF")
    if (archivo.size > MAX_BYTES) throw new DomainError("La evidencia pesa más de 8 MB")
    // Ruta que exige la política de Storage: {club}/acuerdos/{archivo}
    const evidencia_path = `${s.club_id}/acuerdos/${crypto.randomUUID()}.${ext}`
    check(await s.supabase.storage.from("comprobantes").upload(evidencia_path, archivo, { contentType: archivo.type }))

    const acuerdo = check(
      await s.supabase
        .from("acuerdos_pago")
        .insert({ club_id: s.club_id, miembro_id: obl.miembro_id, obligacion_id, notas, evidencia_path })
        .select("id")
        .single(),
    )
    if (!acuerdo) throw new DomainError("No se pudo registrar el acuerdo")
    check(
      await s.supabase.from("cuotas_acuerdo").insert(cuotas.map((c) => ({ club_id: s.club_id, acuerdo_id: acuerdo.id, ...c }))),
    )
    const total = cuotas.reduce((sum, c) => sum + c.monto, 0)
    return `Acuerdo registrado. Son ${formatCOP(total)} en ${cuotas.length} ${cuotas.length === 1 ? "cuota" : "cuotas"} para "${obl.eventos_cobro?.nombre ?? ""}"`
  })
}

export async function cancelarAcuerdoAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("tesorero")
    const filas = check(
      await s.supabase.from("acuerdos_pago").update({ estado: "cancelado" }).eq("id", id).eq("estado", "activo").select("id"),
    )
    if (!filas?.length) throw new DomainError("Este acuerdo ya estaba cancelado")
    return "Acuerdo cancelado"
  })
}

/** Reemplaza el plan de cuotas en bloque (queda un solo registro en la bitácora). */
export async function ajustarCuotasAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("tesorero")
    const id = String(formData.get("acuerdo_id") ?? "")
    const acuerdo = check(await s.supabase.from("acuerdos_pago").select("id, club_id, estado").eq("id", id).maybeSingle())
    if (!acuerdo || acuerdo.club_id !== s.club_id) throw new DomainError("Acuerdo no encontrado")
    if (acuerdo.estado !== "activo") throw new DomainError("Este acuerdo está cancelado. Crea uno nuevo en vez de editarlo")
    const cuotas = leerCuotas(formData)
    check(await s.supabase.from("cuotas_acuerdo").delete().eq("acuerdo_id", id))
    check(
      await s.supabase.from("cuotas_acuerdo").insert(cuotas.map((c) => ({ club_id: s.club_id, acuerdo_id: id, ...c }))),
    )
    return "Cuotas actualizadas"
  })
}
