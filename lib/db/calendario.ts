import "server-only"
import type { Supabase } from "@/lib/supabase/server"
import { agruparPorMes, type EventoAgrupable, type MesCalendario } from "@/lib/calendario"

/** Cobros del miembro en el año, agrupados por mes, con mensualidad estimada donde falta. */
export async function cobrosDelAño(
  sb: Supabase,
  clubId: string,
  miembroId: string,
  año: number,
): Promise<{ meses: MesCalendario[] }> {
  const inicio = `${año}-01-01`
  const fin = `${año + 1}-01-01`
  const { data: eventos, error } = await sb
    .from("eventos_cobro")
    .select("id, nombre, tipo, fecha_limite")
    .eq("club_id", clubId)
    .eq("estado", "activo")
    .gte("fecha_limite", inicio)
    .lt("fecha_limite", fin)
    .order("fecha_limite")
  if (error) throw error
  const ids = (eventos ?? []).map((e) => e.id)
  const [obligaciones, mensualidad] = await Promise.all([
    ids.length
      ? sb.from("obligaciones").select("evento_id, monto, pagado").eq("miembro_id", miembroId).in("evento_id", ids)
      : Promise.resolve({ data: [] as { evento_id: string; monto: number; pagado: number }[], error: null }),
    sb
      .from("eventos_cobro")
      .select("monto")
      .eq("club_id", clubId)
      .eq("estado", "activo")
      .eq("tipo", "mensualidad")
      .lt("fecha_limite", fin)
      .order("fecha_limite", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (obligaciones.error) throw obligaciones.error
  if (mensualidad.error) throw mensualidad.error
  const porEvento = new Map((obligaciones.data ?? []).map((o) => [o.evento_id, { monto: Number(o.monto), pagado: Number(o.pagado) }]))
  const agrupables: EventoAgrupable[] = (eventos ?? []).map((e) => ({
    nombre: e.nombre,
    tipo: e.tipo,
    fecha_limite: e.fecha_limite,
    obligacion: porEvento.get(e.id) ?? null,
  }))
  return { meses: agruparPorMes(año, agrupables, mensualidad.data ? Number(mensualidad.data.monto) : null) }
}
