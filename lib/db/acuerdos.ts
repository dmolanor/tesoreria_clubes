import "server-only"
import type { Supabase } from "@/lib/supabase/server"
import type { EstadoAcuerdo } from "./types"

export interface CuotaVista {
  numero: number
  fecha: string
  monto: number
}

export interface AcuerdoVista {
  id: string
  estado: EstadoAcuerdo
  notas: string | null
  created_at: string
  miembro_id: string
  miembro: string
  obligacion_id: string
  monto_deuda: number
  pagado_deuda: number
  evento: string
  fecha_limite: string
  cuotas: CuotaVista[]
}

/** Acuerdos del club con jugador, deuda y cuotas (tesorería y administración). */
export async function acuerdosDelClub(sb: Supabase, clubId: string): Promise<AcuerdoVista[]> {
  const { data, error } = await sb
    .from("acuerdos_pago")
    .select(
      "id, estado, notas, created_at, miembro_id, obligacion_id, jugador:miembros!acuerdos_pago_club_id_miembro_id_fkey(nombre), obligaciones!inner(monto, pagado, eventos_cobro!inner(nombre, fecha_limite)), cuotas_acuerdo(numero, fecha, monto)",
    )
    .eq("club_id", clubId)
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapear)
}

/** Acuerdos de un jugador (él ve los suyos). */
export async function acuerdosDeMiembro(sb: Supabase, miembroId: string): Promise<AcuerdoVista[]> {
  const { data, error } = await sb
    .from("acuerdos_pago")
    .select(
      "id, estado, notas, created_at, miembro_id, obligacion_id, jugador:miembros!acuerdos_pago_club_id_miembro_id_fkey(nombre), obligaciones!inner(monto, pagado, eventos_cobro!inner(nombre, fecha_limite)), cuotas_acuerdo(numero, fecha, monto)",
    )
    .eq("miembro_id", miembroId)
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapear)
}

function mapear(a: {
  id: string
  estado: EstadoAcuerdo
  notas: string | null
  created_at: string
  miembro_id: string
  obligacion_id: string
  jugador: { nombre: string } | null
  obligaciones: { monto: number; pagado: number; eventos_cobro: { nombre: string; fecha_limite: string } }
  cuotas_acuerdo: CuotaVista[]
}): AcuerdoVista {
  return {
    id: a.id,
    estado: a.estado,
    notas: a.notas,
    created_at: a.created_at,
    miembro_id: a.miembro_id,
    obligacion_id: a.obligacion_id,
    miembro: a.jugador?.nombre ?? "?",
    monto_deuda: Number(a.obligaciones.monto),
    pagado_deuda: Number(a.obligaciones.pagado),
    evento: a.obligaciones.eventos_cobro.nombre,
    fecha_limite: a.obligaciones.eventos_cobro.fecha_limite,
    cuotas: [...(a.cuotas_acuerdo ?? [])]
      .map((c) => ({ numero: c.numero, fecha: c.fecha, monto: Number(c.monto) }))
      .sort((x, y) => x.numero - y.numero),
  }
}
