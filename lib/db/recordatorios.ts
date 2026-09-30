import "server-only"
import type { Supabase } from "@/lib/supabase/server"
import type { ReglaRecordatorio } from "./types"
import { acuerdosDelClub } from "./acuerdos"
import { eventosDelClub } from "./admin"
import { enMora, pendientesPorMiembro } from "./tesoreria"
import { estadoCuotas } from "@/lib/acuerdos"

export async function reglasDelClub(sb: Supabase, clubId: string): Promise<ReglaRecordatorio[]> {
  const { data, error } = await sb.from("reglas_recordatorio").select("*").eq("club_id", clubId).order("created_at")
  if (error) throw error
  return data ?? []
}

export interface DeudorDetalle {
  id: string
  nombre: string
  categoria: string | null
  deudas: string[]
}

/** En mora con el detalle de cada deuda vencida (para el mensaje grupal). */
export async function deudoresConDetalle(sb: Supabase, clubId: string, hoy: string): Promise<DeudorDetalle[]> {
  const mora = await enMora(sb, clubId, hoy)
  if (!mora.length) return []
  const pendientes = await pendientesPorMiembro(sb, mora.map((m) => m.id))
  return mora.map((m) => ({
    id: m.id,
    nombre: m.nombre,
    categoria: m.categoria,
    deudas: (pendientes.get(m.id) ?? []).filter((p) => p.fecha_limite < hoy).map((p) => p.evento),
  }))
}

export interface CuotaProxima {
  miembro: string
  evento: string
  fecha: string
  monto: number
}

/** Cuotas de acuerdos activos que vencen en los próximos días y siguen sin cubrir. */
export async function proximasCuotas(sb: Supabase, clubId: string, hoy: string, dias = 7): Promise<CuotaProxima[]> {
  const limite = new Date(`${hoy}T00:00:00Z`)
  limite.setUTCDate(limite.getUTCDate() + dias)
  const hasta = limite.toISOString().slice(0, 10)
  const acuerdos = await acuerdosDelClub(sb, clubId)
  return acuerdos
    .filter((a) => a.estado === "activo")
    .flatMap((a) =>
      estadoCuotas(a.pagado_deuda, a.cuotas)
        .filter((c) => !c.cubierta && c.fecha >= hoy && c.fecha <= hasta)
        .map((c) => ({ miembro: a.miembro, evento: a.evento, fecha: c.fecha, monto: c.monto })),
    )
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export interface VencimientoProximo {
  evento_id: string
  evento: string
  fecha_limite: string
  monto: number
  pendientes: string[]
}

/** Cobros activos que vencen en los próximos días, con quién los debe. */
export async function vencimientosEn(sb: Supabase, clubId: string, hoy: string, dias: number): Promise<VencimientoProximo[]> {
  const limite = new Date(`${hoy}T00:00:00Z`)
  limite.setUTCDate(limite.getUTCDate() + dias)
  const hasta = limite.toISOString().slice(0, 10)
  const eventos = (await eventosDelClub(sb, clubId)).filter((e) => e.estado === "activo" && e.fecha_limite > hoy && e.fecha_limite <= hasta)
  if (!eventos.length) return []
  const { data, error } = await sb
    .from("obligaciones")
    .select("evento_id, monto, pagado, miembros(nombre)")
    .in(
      "evento_id",
      eventos.map((e) => e.id),
    )
  if (error) throw error
  return eventos.map((e) => ({
    evento_id: e.id,
    evento: e.nombre,
    fecha_limite: e.fecha_limite,
    monto: Number(e.monto),
    pendientes: (data ?? [])
      .filter((o) => o.evento_id === e.id && Number(o.pagado) < Number(o.monto))
      .map((o) => o.miembros?.nombre ?? "?")
      .sort((a, b) => a.localeCompare(b)),
  }))
}
