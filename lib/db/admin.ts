import "server-only"
import type { Supabase } from "@/lib/supabase/server"
import type { EventoCobro } from "./types"

export interface Progreso {
  total: number
  pagadas: number
  recaudado: number
  monto_total: number
}

export async function progresoEventos(sb: Supabase, clubId: string) {
  const { data, error } = await sb.from("progreso_eventos").select("*").eq("club_id", clubId)
  if (error) throw error
  return new Map(
    (data ?? []).map((p) => [
      p.evento_id!,
      { total: p.total ?? 0, pagadas: p.pagadas ?? 0, recaudado: Number(p.recaudado ?? 0), monto_total: Number(p.monto_total ?? 0) } satisfies Progreso,
    ]),
  )
}

export async function eventosDelClub(sb: Supabase, clubId: string) {
  const { data, error } = await sb.from("eventos_cobro").select("*").eq("club_id", clubId).order("fecha_limite", { ascending: false })
  if (error) throw error
  return data ?? []
}

export function alcanceLabel(e: Pick<EventoCobro, "alcance" | "categoria">, individuales?: number) {
  if (e.alcance === "todos") return "Todos"
  if (e.alcance === "grupo") return e.categoria ?? ""
  return individuales === undefined ? "Individual" : `${individuales} jugadores`
}

/** Jugadores del club (quienes tienen el rol jugador), por nombre. */
export async function jugadoresDelClub(sb: Supabase, clubId: string) {
  const { data, error } = await sb.from("miembros").select("*").eq("club_id", clubId).contains("roles", ["jugador"]).order("nombre")
  if (error) throw error
  return data ?? []
}

export async function opcionesJugadores(sb: Supabase, clubId: string) {
  return (await jugadoresDelClub(sb, clubId))
    .filter((u) => u.estado !== "retirado")
    .map((u) => ({ id: u.id, nombre: u.nombre, categoria: u.categoria }))
}

/** Miembros que aún no tienen cuenta en Auth (nunca invitados). Las cuentas demo no cuentan. */
export async function miembrosSinCuenta(sb: Supabase, clubId: string): Promise<number> {
  const { count, error } = await sb
    .from("miembros")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId)
    .is("auth_user_id", null)
    .neq("estado", "retirado")
    .not("correo", "like", "%@example.com")
  if (error) throw error
  return count ?? 0
}

export async function categoriasDelClub(sb: Supabase, clubId: string): Promise<string[]> {
  const { data, error } = await sb.from("clubes").select("categorias").eq("id", clubId).single()
  if (error) throw error
  return data.categorias
}
