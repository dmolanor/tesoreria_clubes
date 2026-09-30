import "server-only"
import type { Supabase } from "@/lib/supabase/server"
import type { EstadoCuenta } from "./types"

export interface Cuenta {
  total_pendiente: number
  total_vencido: number
  proximo_vencimiento: string | null
  saldo_a_favor: number
  estado: EstadoCuenta
}

const VACIA: Cuenta = { total_pendiente: 0, total_vencido: 0, proximo_vencimiento: null, saldo_a_favor: 0, estado: "al_dia" }

/** Estados de cuenta (vista `estado_cuenta_miembros`) indexados por miembro. */
export async function estadosDeCuenta(sb: Supabase, clubId: string, miembroIds?: string[]) {
  let q = sb.from("estado_cuenta_miembros").select("*").eq("club_id", clubId)
  if (miembroIds) q = q.in("miembro_id", miembroIds)
  const { data, error } = await q
  if (error) throw error
  return new Map(
    (data ?? []).map((r) => [
      r.miembro_id!,
      {
        total_pendiente: Number(r.total_pendiente ?? 0),
        total_vencido: Number(r.total_vencido ?? 0),
        proximo_vencimiento: r.proximo_vencimiento,
        saldo_a_favor: Number(r.saldo_a_favor ?? 0),
        estado: (r.estado_cuenta ?? "al_dia") as EstadoCuenta,
      } satisfies Cuenta,
    ]),
  )
}

export async function estadoCuenta(sb: Supabase, clubId: string, miembroId: string): Promise<Cuenta> {
  return (await estadosDeCuenta(sb, clubId, [miembroId])).get(miembroId) ?? VACIA
}

export interface ObligacionDetalle {
  id: string
  monto: number
  pagado: number
  saldo: number
  evento: { id: string; nombre: string; fecha_limite: string }
}

/** Obligaciones del miembro en eventos activos, de la más reciente a la más antigua. */
export async function obligacionesDe(sb: Supabase, miembroId: string): Promise<ObligacionDetalle[]> {
  const { data, error } = await sb
    .from("obligaciones")
    .select("id, monto, pagado, eventos_cobro!inner(id, nombre, fecha_limite, estado)")
    .eq("miembro_id", miembroId)
    .eq("eventos_cobro.estado", "activo")
  if (error) throw error
  return (data ?? [])
    .map((o) => ({
      id: o.id,
      monto: Number(o.monto),
      pagado: Number(o.pagado),
      saldo: Math.max(0, Number(o.monto) - Number(o.pagado)),
      evento: { id: o.eventos_cobro.id, nombre: o.eventos_cobro.nombre, fecha_limite: o.eventos_cobro.fecha_limite },
    }))
    .sort((a, b) => b.evento.fecha_limite.localeCompare(a.evento.fecha_limite))
}

export interface LineaAplicada {
  evento: string
  monto: number
  regla: string
}

export interface ComprobanteDetalle {
  id: string
  monto: number
  fecha_pago: string
  created_at: string
  estado: "pendiente" | "aceptado" | "rechazado"
  motivo_rechazo: string | null
  archivo_path: string | null
  revisado_por: string | null
  revisado_en: string | null
  desglose: LineaAplicada[]
  saldo_a_favor: number
}

const ORIGEN: Record<string, string> = { manual: "Ajuste manual", saldo_a_favor: "Saldo a favor", propuesta: "Regla" }

/** Comprobantes con su desglose aplicado (solo aplicaciones activas). */
export async function comprobantesDe(sb: Supabase, filtro: { miembroId?: string; ids?: string[] }): Promise<ComprobanteDetalle[]> {
  let q = sb
    .from("comprobantes")
    .select(
      "id, monto, fecha_pago, created_at, estado, motivo_rechazo, archivo_path, revisado_por, revisado_en, aplicaciones(monto, origen, anulada_en, reglas_conciliacion(nombre), obligaciones(eventos_cobro(nombre)))",
    )
    .order("created_at", { ascending: false })
  if (filtro.miembroId) q = q.eq("miembro_id", filtro.miembroId)
  if (filtro.ids) q = q.in("id", filtro.ids)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((c) => {
    const activas = (c.aplicaciones ?? []).filter((a) => !a.anulada_en)
    const aplicado = activas.reduce((s, a) => s + Number(a.monto), 0)
    return {
      id: c.id,
      monto: Number(c.monto),
      fecha_pago: c.fecha_pago,
      created_at: c.created_at,
      estado: c.estado,
      motivo_rechazo: c.motivo_rechazo,
      archivo_path: c.archivo_path,
      revisado_por: c.revisado_por,
      revisado_en: c.revisado_en,
      desglose: activas.map((a) => ({
        evento: a.obligaciones?.eventos_cobro?.nombre ?? "?",
        monto: Number(a.monto),
        regla: a.reglas_conciliacion?.nombre ?? ORIGEN[a.origen],
      })),
      saldo_a_favor: c.estado === "aceptado" ? Number(c.monto) - aplicado : 0,
    }
  })
}

/** URLs firmadas (10 min) para ver archivos privados del bucket `comprobantes`. */
export async function urlsFirmadas(sb: Supabase, paths: (string | null)[]): Promise<Map<string, string>> {
  const validos = paths.filter((p): p is string => !!p)
  if (!validos.length) return new Map()
  const { data, error } = await sb.storage.from("comprobantes").createSignedUrls(validos, 600)
  if (error) throw error
  return new Map((data ?? []).flatMap((d) => (d.signedUrl && d.path ? [[d.path, d.signedUrl] as [string, string]] : [])))
}
