"use server"

import { getStore } from "@/lib/data"
import { ctxFrom, requireRole } from "@/lib/auth/session"
import { runAction, type ActionResult } from "@/lib/action-result"
import { guardarConciliacion } from "@/lib/domain/ledger"
import { formatCOP, parseMonto } from "@/lib/format"

export async function guardarConciliacionAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("tesorero")
    const { diferencia } = await getStore().transaction((db) =>
      guardarConciliacion(db, ctxFrom(s), {
        mes: String(formData.get("mes")),
        saldo_inicial: parseMonto(formData.get("saldo_inicial")),
        saldo_final: parseMonto(formData.get("saldo_final")),
        notas: String(formData.get("notas") ?? "").trim() || null,
      }),
    )
    return diferencia === 0 ? "Conciliación guardada — cuadrada, $0 de diferencia" : `Conciliación guardada con ${formatCOP(diferencia)} de diferencia`
  })
}
