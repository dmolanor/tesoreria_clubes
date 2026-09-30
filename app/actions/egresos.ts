"use server"

import { requireRole } from "@/lib/auth/session"
import { check, runAction, DomainError, type ActionResult } from "@/lib/action-result"
import { Constants } from "@/lib/data/database.types"
import type { CategoriaEgreso } from "@/lib/db/types"
import { formatCOP, formatMes, hoyISO, parseMonto } from "@/lib/format"

// Mismos formatos y límite que el bucket `comprobantes`, donde viven también los soportes.
const TIPOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
}
const MAX_BYTES = 8 * 1024 * 1024

/** Tesorero: registra un egreso del club, con soporte opcional (factura o recibo). */
export async function registrarEgresoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("tesorero")
    const monto = parseMonto(formData.get("monto"))
    if (monto <= 0) throw new DomainError("Escribe el monto que salió de la cuenta")
    const concepto = String(formData.get("concepto") ?? "").trim()
    if (!concepto) throw new DomainError("Escribe en qué se gastó (ej. Arriendo cancha sábados)")
    const categoria = String(formData.get("categoria") ?? "otro") as CategoriaEgreso
    if (!Constants.public.Enums.categoria_egreso.includes(categoria)) throw new DomainError("Elige una categoría de la lista")
    const fecha = String(formData.get("fecha") || hoyISO())
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha > hoyISO()) throw new DomainError("La fecha del egreso no puede ser posterior a hoy")

    let soporte_path: string | null = null
    const archivo = formData.get("soporte")
    if (archivo instanceof File && archivo.size > 0) {
      const ext = TIPOS[archivo.type]
      if (!ext) throw new DomainError("El soporte debe ser una imagen (JPG, PNG, WEBP, HEIC) o un PDF")
      if (archivo.size > MAX_BYTES) throw new DomainError("El soporte pesa más de 8 MB")
      // Ruta que exige la política de Storage: {club}/egresos/{archivo}
      soporte_path = `${s.club_id}/egresos/${crypto.randomUUID()}.${ext}`
      check(await s.supabase.storage.from("comprobantes").upload(soporte_path, archivo, { contentType: archivo.type }))
    }

    check(await s.supabase.from("egresos").insert({ club_id: s.club_id, fecha, monto, concepto, categoria, soporte_path }))
    return `Egreso de ${formatCOP(monto)} registrado en ${formatMes(fecha)}`
  })
}

/** Tesorero: anula un egreso registrado por error. No se borra: deja de contar en el cuadre. */
export async function anularEgresoAction(egresoId: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("tesorero")
    const filas = check(
      await s.supabase
        .from("egresos")
        .update({ anulado_en: new Date().toISOString() })
        .eq("id", egresoId)
        .eq("club_id", s.club_id)
        .is("anulado_en", null)
        .select("monto, fecha"),
    )
    const e = filas?.[0]
    if (!e) throw new DomainError("Este egreso ya estaba anulado")
    return `Egreso de ${formatCOP(Number(e.monto))} anulado. Ya no cuenta en el cuadre de ${formatMes(e.fecha)}`
  })
}
