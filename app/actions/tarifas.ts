"use server"

import { requireRole } from "@/lib/auth/session"
import { check, runAction, DomainError, type ActionResult } from "@/lib/action-result"
import { parseMonto } from "@/lib/format"
import type { EstadoMiembro } from "@/lib/db/types"

const ESTADOS_TARIFA: EstadoMiembro[] = ["lesionado", "inactivo"]

/**
 * Administración: configura cuánto paga un jugador lesionado o inactivo, en vez de la mensualidad
 * completa. Actualiza o inserta a mano (en vez de `upsert`) porque el grant de `update` solo cubre
 * `monto_mensual`: un upsert que incluya `club_id`/`estado` en el `set` chocaría con RLS por columna.
 */
export async function guardarTarifasAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("administrativo")
    for (const estado of ESTADOS_TARIFA) {
      const monto_mensual = parseMonto(formData.get(estado))
      if (monto_mensual < 0) throw new DomainError("La tarifa no puede ser negativa")
      const actualizadas = check(
        await s.supabase.from("tarifas_estado").update({ monto_mensual }).eq("club_id", s.club_id).eq("estado", estado).select("estado"),
      )
      if (!actualizadas?.length) {
        check(await s.supabase.from("tarifas_estado").insert({ club_id: s.club_id, estado, monto_mensual }))
      }
    }
    return "Tarifas actualizadas"
  })
}
