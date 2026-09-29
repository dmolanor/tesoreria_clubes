"use server"

import { getStore } from "@/lib/data"
import { ctxFrom, requireRole } from "@/lib/auth/session"
import { runAction, type ActionResult } from "@/lib/action-result"
import { cancelarEvento, crearEvento, editarEvento, DomainError } from "@/lib/domain/ledger"
import { parseMonto } from "@/lib/format"
import type { Alcance } from "@/lib/data/types"

export async function crearEventoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("administrativo")
    const alcance = String(formData.get("alcance")) as Alcance
    let alcance_valor: string | null = null
    if (alcance === "grupo") alcance_valor = String(formData.get("categoria"))
    if (alcance === "individual") alcance_valor = formData.getAll("jugadores").map(String).join(",")
    const fecha_limite = String(formData.get("fecha_limite") ?? "")
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_limite)) throw new DomainError("Elige la fecha límite")
    const n = await getStore().transaction((db) => {
      const id = crearEvento(db, ctxFrom(s), {
        nombre: String(formData.get("nombre") ?? ""),
        monto: parseMonto(formData.get("monto")),
        fecha_limite,
        alcance,
        alcance_valor,
      })
      return db.obligaciones.filter((o) => o.evento_cobro_id === id).length
    })
    return `Evento creado — ${n} jugadores ya lo ven en su estado de cuenta`
  })
}

export async function editarEventoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("administrativo")
    await getStore().transaction((db) =>
      editarEvento(db, ctxFrom(s), String(formData.get("id")), {
        nombre: String(formData.get("nombre") ?? ""),
        fecha_limite: String(formData.get("fecha_limite") ?? ""),
      }),
    )
    return "Evento actualizado"
  })
}

export async function cancelarEventoAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("administrativo")
    await getStore().transaction((db) => cancelarEvento(db, ctxFrom(s), id))
    return "Evento cancelado"
  })
}
