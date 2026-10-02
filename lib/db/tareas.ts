import "server-only"
import type { Supabase } from "@/lib/supabase/server"

export interface TareaDeJugador {
  id: string
  nombre: string
  link: string
  fecha_limite: string
  completada_en: string | null
}

/** Tareas activas asignadas al miembro, para la sección "Tareas" de su inicio. */
export async function tareasDeMiembro(sb: Supabase, miembroId: string): Promise<TareaDeJugador[]> {
  const { data, error } = await sb
    .from("tareas_miembros")
    .select("completada_en, tareas!inner(id, nombre, link, fecha_limite, estado)")
    .eq("miembro_id", miembroId)
    .eq("tareas.estado", "activa")
  if (error) throw error
  return (data ?? [])
    .map((r) => ({
      id: r.tareas.id,
      nombre: r.tareas.nombre,
      link: r.tareas.link,
      fecha_limite: r.tareas.fecha_limite,
      completada_en: r.completada_en,
    }))
    .sort((a, b) => a.fecha_limite.localeCompare(b.fecha_limite))
}

export interface TareaConProgreso {
  id: string
  nombre: string
  fecha_limite: string
  total: number
  completadas: number
  /** Quién falta, para la lista desplegable. */
  pendientes: Array<{ id: string; nombre: string }>
}

/** Tareas activas del club con su progreso, para la tarjeta de administración y tesorería. */
export async function tareasDelClub(sb: Supabase, clubId: string): Promise<TareaConProgreso[]> {
  const { data: tareas, error } = await sb
    .from("tareas")
    .select("id, nombre, fecha_limite")
    .eq("club_id", clubId)
    .eq("estado", "activa")
    .order("fecha_limite")
  if (error) throw error
  if (!tareas?.length) return []

  const ids = tareas.map((t) => t.id)
  const { data: asignaciones, error: e2 } = await sb
    .from("tareas_miembros")
    .select("tarea_id, completada_en, miembros(id, nombre)")
    .in("tarea_id", ids)
  if (e2) throw e2

  const total = new Map<string, number>()
  const pendientes = new Map<string, Array<{ id: string; nombre: string }>>()
  for (const a of asignaciones ?? []) {
    total.set(a.tarea_id, (total.get(a.tarea_id) ?? 0) + 1)
    if (!a.completada_en && a.miembros) {
      const arr = pendientes.get(a.tarea_id) ?? []
      arr.push({ id: a.miembros.id, nombre: a.miembros.nombre })
      pendientes.set(a.tarea_id, arr)
    }
  }

  return tareas.map((t) => {
    const n = total.get(t.id) ?? 0
    const faltan = (pendientes.get(t.id) ?? []).sort((a, b) => a.nombre.localeCompare(b.nombre))
    return { id: t.id, nombre: t.nombre, fecha_limite: t.fecha_limite, total: n, completadas: n - faltan.length, pendientes: faltan }
  })
}
