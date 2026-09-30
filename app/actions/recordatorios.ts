"use server"

import { requireRole } from "@/lib/auth/session"
import { check, runAction, DomainError, type ActionResult } from "@/lib/action-result"
import type { TipoRecordatorio } from "@/lib/db/types"

const TIPOS: TipoRecordatorio[] = ["mensual", "previo_vencimiento", "acuerdo_pago"]

function leerRegla(formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim()
  if (!nombre) throw new DomainError("El recordatorio necesita un nombre")
  const tipo = String(formData.get("tipo") ?? "") as TipoRecordatorio
  if (!TIPOS.includes(tipo)) throw new DomainError("Elige el tipo de recordatorio")
  const dia_mes = formData.get("dia_mes") ? Number(formData.get("dia_mes")) : null
  const dias_antes = formData.get("dias_antes") ? Number(formData.get("dias_antes")) : null
  if (tipo === "mensual" && (!dia_mes || dia_mes < 1 || dia_mes > 28)) throw new DomainError("Elige el día del mes (1 a 28)")
  if (tipo === "previo_vencimiento" && (!dias_antes || dias_antes < 1 || dias_antes > 30)) {
    throw new DomainError("Elige cuántos días antes del vencimiento (1 a 30)")
  }
  const canal = String(formData.get("canal") ?? "whatsapp").trim() || "whatsapp"
  return { nombre, tipo, dia_mes: tipo === "mensual" ? dia_mes : null, dias_antes: tipo === "previo_vencimiento" ? dias_antes : null, canal }
}

export async function crearReglaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("tesorero")
    check(await s.supabase.from("reglas_recordatorio").insert({ club_id: s.club_id, ...leerRegla(formData) }))
    return "Recordatorio creado"
  })
}

export async function editarReglaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("tesorero")
    check(await s.supabase.from("reglas_recordatorio").update(leerRegla(formData)).eq("id", String(formData.get("id"))))
    return "Recordatorio actualizado"
  })
}

export async function toggleReglaAction(id: string, activa: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("tesorero")
    check(await s.supabase.from("reglas_recordatorio").update({ activa }).eq("id", id))
  })
}

export async function eliminarReglaAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("tesorero")
    check(await s.supabase.from("reglas_recordatorio").delete().eq("id", id))
    return "Recordatorio eliminado"
  })
}
