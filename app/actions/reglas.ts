"use server"

import { getStore } from "@/lib/data"
import { ctxFrom, requireRole } from "@/lib/auth/session"
import { runAction, type ActionResult } from "@/lib/action-result"
import { agregarReglaEvento, eliminarRegla, moverRegla, toggleRegla } from "@/lib/domain/ledger"

// Solo el tesorero configura reglas (decisión explícita del club; el admin solo las ve).

export async function moverReglaAction(id: string, dir: "arriba" | "abajo"): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("tesorero")
    await getStore().transaction((db) => moverRegla(db, ctxFrom(s), id, dir))
  })
}

export async function toggleReglaAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("tesorero")
    await getStore().transaction((db) => toggleRegla(db, ctxFrom(s), id))
  })
}

export async function agregarReglaEventoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("tesorero")
    await getStore().transaction((db) => agregarReglaEvento(db, ctxFrom(s), String(formData.get("evento_cobro_id"))))
    return "Regla agregada con la prioridad más alta"
  })
}

export async function eliminarReglaAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("tesorero")
    await getStore().transaction((db) => eliminarRegla(db, ctxFrom(s), id))
  })
}
