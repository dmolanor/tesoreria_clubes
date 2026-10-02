import "server-only"
import type { Supabase } from "@/lib/supabase/server"
import { esEgresoDeCruce, rangoMes } from "@/lib/cuadre"

/**
 * Egresos cuya fecha cae en el mes (incluye anulados y los de cruce, para la lista de /egresos);
 * `total`/`vigentes` son los que cuentan en el cuadre: ni anulados ni egresos de cruce (no mueven
 * el banco, se anulan con la compensación — ver `lib/cuadre.ts`).
 */
export async function egresosMes(sb: Supabase, clubId: string, mes: string) {
  const { inicio, fin } = rangoMes(mes)
  const { data, error } = await sb
    .from("egresos")
    .select("id, fecha, monto, concepto, categoria, categoria_otro, evento_id, comprobante_id, soporte_path, anulado_en, created_at, eventos_cobro(nombre)")
    .eq("club_id", clubId)
    .gte("fecha", inicio)
    .lt("fecha", fin)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
  if (error) throw error
  const items = (data ?? []).map((e) => ({ ...e, monto: Number(e.monto), evento: e.eventos_cobro?.nombre ?? null }))
  const vigentes = items.filter((e) => !e.anulado_en && !esEgresoDeCruce(e.comprobante_id))
  return { items, total: vigentes.reduce((s, e) => s + e.monto, 0), vigentes: vigentes.length }
}

export type EgresoMes = Awaited<ReturnType<typeof egresosMes>>["items"][number]
