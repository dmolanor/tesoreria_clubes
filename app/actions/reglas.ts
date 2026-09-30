"use server"

import { requireRole } from "@/lib/auth/session"
import { check, runAction, type ActionResult } from "@/lib/action-result"
import { reglasDelClub } from "@/lib/db/tesoreria"

// Solo el tesorero configura reglas (decisión del club; RLS lo exige también).

export async function moverReglaAction(id: string, dir: "arriba" | "abajo"): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("tesorero")
    const ids = (await reglasDelClub(s.supabase, s.club_id)).map((r) => r.id)
    const i = ids.indexOf(id)
    const j = dir === "arriba" ? i - 1 : i + 1
    if (i < 0 || j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    check(await s.supabase.rpc("reordenar_reglas", { p_club_id: s.club_id, p_ids: ids }))
  })
}

export async function toggleReglaAction(id: string, activa: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("tesorero")
    check(await s.supabase.from("reglas_conciliacion").update({ activa }).eq("id", id))
  })
}

export async function agregarReglaEventoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("tesorero")
    check(await s.supabase.rpc("agregar_regla_evento", { p_club_id: s.club_id, p_evento_id: String(formData.get("evento_cobro_id")) }))
    return "Regla agregada con la prioridad más alta"
  })
}

export async function eliminarReglaAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("tesorero")
    // Los huecos de prioridad no importan: el motor solo ordena.
    check(await s.supabase.from("reglas_conciliacion").delete().eq("id", id))
  })
}
