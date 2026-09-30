import "server-only"
import type { Supabase } from "@/lib/supabase/server"
import { proposeAllocation } from "@/lib/engine/propose"
import type { EngineRule, PendingObligation, Proposal } from "@/lib/engine/types"
import { necesitaHumano } from "@/lib/revision"
import type { Json } from "@/lib/data/database.types"

export interface PendienteConEvento extends PendingObligation {
  evento: string
}

/** Obligaciones con saldo de varios miembros (eventos activos), agrupadas por miembro, FIFO. */
export async function pendientesPorMiembro(sb: Supabase, miembroIds: string[]) {
  const porMiembro = new Map<string, PendienteConEvento[]>()
  if (!miembroIds.length) return porMiembro
  const { data, error } = await sb
    .from("obligaciones")
    .select("id, miembro_id, monto, pagado, eventos_cobro!inner(id, nombre, fecha_limite, estado)")
    .in("miembro_id", miembroIds)
    .eq("eventos_cobro.estado", "activo")
  if (error) throw error
  for (const o of data ?? []) {
    const saldo = Number(o.monto) - Number(o.pagado)
    if (saldo <= 0) continue
    const lista = porMiembro.get(o.miembro_id) ?? []
    lista.push({
      obligacion_id: o.id,
      evento_cobro_id: o.eventos_cobro.id,
      fecha_limite: o.eventos_cobro.fecha_limite,
      saldo_pendiente: saldo,
      evento: o.eventos_cobro.nombre,
    })
    porMiembro.set(o.miembro_id, lista)
  }
  for (const lista of porMiembro.values()) lista.sort((a, b) => a.fecha_limite.localeCompare(b.fecha_limite))
  return porMiembro
}

export async function reglasDelClub(sb: Supabase, clubId: string) {
  const { data, error } = await sb.from("reglas_conciliacion").select("*").eq("club_id", clubId).order("prioridad")
  if (error) throw error
  return data ?? []
}

export function comoReglasMotor(reglas: Awaited<ReturnType<typeof reglasDelClub>>): EngineRule[] {
  return reglas.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    condicion: (r.parametros ?? {}) as Record<string, unknown>,
    prioridad: r.prioridad,
    activa: r.activa,
  }))
}

export interface ComprobantePendiente {
  id: string
  miembro_id: string
  miembro: string
  monto: number
  fecha_pago: string
  created_at: string
  archivo_path: string | null
  canal: string
  propuesta: Proposal
  pendientes: PendienteConEvento[]
  revision: { requiere: boolean; motivos: string[] }
}

/**
 * Bandeja del tesorero: comprobantes pendientes con la propuesta del motor ya
 * calculada. Los que requieren revisión humana van primero.
 */
export async function bandeja(sb: Supabase, clubId: string, filtro?: { id?: string }): Promise<ComprobantePendiente[]> {
  let q = sb
    .from("comprobantes")
    .select("id, miembro_id, monto, fecha_pago, created_at, archivo_path, canal, extraccion, miembros!comprobantes_club_id_miembro_id_fkey(nombre)")
    .eq("club_id", clubId)
    .eq("estado", "pendiente")
    .order("created_at")
  if (filtro?.id) q = q.eq("id", filtro.id)
  const { data, error } = await q
  if (error) throw error
  const comps = data ?? []
  const [pendientes, reglas] = await Promise.all([
    pendientesPorMiembro(sb, [...new Set(comps.map((c) => c.miembro_id))]),
    reglasDelClub(sb, clubId).then(comoReglasMotor),
  ])
  return comps
    .map((c) => {
      const pend = pendientes.get(c.miembro_id) ?? []
      const propuesta = proposeAllocation({ monto: Number(c.monto), pendientes: pend, reglas })
      return {
        id: c.id,
        miembro_id: c.miembro_id,
        miembro: c.miembros?.nombre ?? "?",
        monto: Number(c.monto),
        fecha_pago: c.fecha_pago,
        created_at: c.created_at,
        archivo_path: c.archivo_path,
        canal: c.canal,
        pendientes: pend,
        propuesta,
        revision: necesitaHumano({ pendientes: pend.length, propuesta, canal: c.canal, extraccion: c.extraccion }),
      }
    })
    .sort((a, b) => Number(b.revision.requiere) - Number(a.revision.requiere) || a.created_at.localeCompare(b.created_at))
}

/** Líneas para la RPC `aceptar_comprobante` (el sobrante no se envía: queda como saldo a favor). */
export function lineasRpc(lineas: Array<{ obligacion_id: string | null; monto_aplicado: number; regla_aplicada: string | null; manual?: boolean }>): Json {
  return lineas
    .filter((l) => l.obligacion_id && l.monto_aplicado > 0)
    .map((l) => ({ obligacion_id: l.obligacion_id, monto: l.monto_aplicado, regla_id: l.regla_aplicada, manual: !!l.manual }))
}

/** Jugadores con obligaciones vencidas, del atraso más antiguo al más reciente. */
export async function enMora(sb: Supabase, clubId: string, hoy: string) {
  const { data, error } = await sb.from("estado_cuenta_miembros").select("miembro_id").eq("club_id", clubId).eq("estado_cuenta", "mora")
  if (error) throw error
  const ids = (data ?? []).map((r) => r.miembro_id!)
  if (!ids.length) return []
  const [{ data: miembros, error: e2 }, pendientes] = await Promise.all([
    sb.from("miembros").select("id, nombre, categoria").in("id", ids),
    pendientesPorMiembro(sb, ids),
  ])
  if (e2) throw e2
  return (miembros ?? [])
    .map((m) => {
      const vencidas = (pendientes.get(m.id) ?? []).filter((p) => p.fecha_limite < hoy)
      return { ...m, vencidas: vencidas.length, desde: vencidas[0]?.fecha_limite ?? hoy }
    })
    .sort((a, b) => a.desde.localeCompare(b.desde))
}

/** Suma de comprobantes aceptados cuya fecha de pago cae en el mes (lo mismo que calcula la base). */
export async function totalAceptadoMes(sb: Supabase, clubId: string, mes: string) {
  const inicio = `${mes.slice(0, 7)}-01`
  const [y, m] = inicio.split("-").map(Number)
  const fin = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10)
  const { data, error } = await sb
    .from("comprobantes")
    .select("monto, estado")
    .eq("club_id", clubId)
    .gte("fecha_pago", inicio)
    .lt("fecha_pago", fin)
  if (error) throw error
  const filas = data ?? []
  return {
    total: filas.filter((c) => c.estado === "aceptado").reduce((s, c) => s + Number(c.monto), 0),
    aceptados: filas.filter((c) => c.estado === "aceptado").length,
    pendientes: filas.filter((c) => c.estado === "pendiente").length,
    rechazados: filas.filter((c) => c.estado === "rechazado").length,
  }
}

export async function conteoPendientes(sb: Supabase, clubId: string) {
  const { count, error } = await sb
    .from("comprobantes")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId)
    .eq("estado", "pendiente")
  if (error) throw error
  return count ?? 0
}
