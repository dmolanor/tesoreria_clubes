import "server-only"
import type { Supabase } from "@/lib/supabase/server"
import { rangoMes } from "@/lib/cuadre"

/** Egresos cuya fecha cae en el mes (incluye anulados, para el historial); `total` solo suma los vigentes. */
export async function egresosMes(sb: Supabase, clubId: string, mes: string) {
  const { inicio, fin } = rangoMes(mes)
  const { data, error } = await sb
    .from("egresos")
    .select("id, fecha, monto, concepto, categoria, soporte_path, anulado_en, created_at")
    .eq("club_id", clubId)
    .gte("fecha", inicio)
    .lt("fecha", fin)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
  if (error) throw error
  const items = (data ?? []).map((e) => ({ ...e, monto: Number(e.monto) }))
  const vigentes = items.filter((e) => !e.anulado_en)
  return { items, total: vigentes.reduce((s, e) => s + e.monto, 0), vigentes: vigentes.length }
}

export type EgresoMes = Awaited<ReturnType<typeof egresosMes>>["items"][number]
