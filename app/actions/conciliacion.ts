"use server"

import { requireRole } from "@/lib/auth/session"
import { check, runAction, type ActionResult } from "@/lib/action-result"
import { formatCOP, parseMonto } from "@/lib/format"

export async function guardarConciliacionAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("tesorero")
    const fila = check(
      await s.supabase.rpc("guardar_conciliacion", {
        p_club_id: s.club_id,
        p_mes: String(formData.get("mes")),
        p_saldo_inicial: parseMonto(formData.get("saldo_inicial")),
        p_saldo_final: parseMonto(formData.get("saldo_final")),
        p_notas: String(formData.get("notas") ?? ""),
      }),
    )
    const diferencia = Number(fila?.diferencia ?? 0)
    return diferencia === 0
      ? "La conciliación quedó cuadrada, $0 de diferencia"
      : `Conciliación guardada con ${formatCOP(diferencia)} de diferencia`
  })
}
