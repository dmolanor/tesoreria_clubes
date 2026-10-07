"use server"

import { requireRole } from "@/lib/auth/session"
import { check, runAction, DomainError, type ActionResult } from "@/lib/action-result"

/** Tesorería: deja una obligación en lo ya pagado (condona el saldo pendiente). */
export async function condonarObligacionAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("tesorero")
    const obligacionId = String(formData.get("obligacion_id") ?? "")
    const motivo = String(formData.get("motivo") ?? "").trim()
    if (!obligacionId) throw new DomainError("Obligación no encontrada")
    if (!motivo) throw new DomainError("Escribe el motivo de la condonación")
    check(await s.supabase.rpc("condonar_obligacion", { p_obligacion_id: obligacionId, p_motivo: motivo }))
    return "Obligación condonada"
  })
}
