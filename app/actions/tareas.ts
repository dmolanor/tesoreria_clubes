"use server"

import { requireRole } from "@/lib/auth/session"
import { check, runAction, DomainError, type ActionResult } from "@/lib/action-result"
import type { AlcanceCobro } from "@/lib/db/types"

export async function crearTareaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("administrativo")
    const alcance = String(formData.get("alcance")) as AlcanceCobro
    const fecha_limite = String(formData.get("fecha_limite") ?? "")
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_limite)) throw new DomainError("Elige la fecha límite")
    const nombre = String(formData.get("nombre") ?? "").trim()
    if (!nombre) throw new DomainError("La tarea necesita un nombre")
    const link = String(formData.get("link") ?? "").trim()
    if (!/^https:\/\//.test(link)) throw new DomainError("El enlace debe empezar con https://")
    const miembros = formData.getAll("jugadores").map(String)
    if (alcance === "individual" && miembros.length === 0) throw new DomainError("Elige al menos un jugador")

    check(
      await s.supabase.rpc("crear_tarea", {
        p_club_id: s.club_id,
        p_nombre: nombre,
        p_link: link,
        p_fecha_limite: fecha_limite,
        p_alcance: alcance,
        p_categoria: alcance === "grupo" ? String(formData.get("categoria")) : undefined,
        p_miembro_ids: alcance === "individual" ? miembros : undefined,
      }),
    )
    return "Tarea creada"
  })
}

export async function cancelarTareaAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("administrativo")
    check(await s.supabase.rpc("cancelar_tarea", { p_tarea_id: id }))
    return "Tarea cancelada"
  })
}

/** El jugador solo puede cambiar `completada_en` de su propia fila (RLS lo exige también). */
export async function marcarTareaAction(tareaId: string, completada: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("jugador")
    check(
      await s.supabase
        .from("tareas_miembros")
        .update({ completada_en: completada ? new Date().toISOString() : null })
        .eq("tarea_id", tareaId)
        .eq("miembro_id", s.usuario.id),
    )
  })
}
