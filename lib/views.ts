import "server-only"
import type { Comprobante, Db, EventoCobro } from "@/lib/data/types"
import { eventoDe, saldoObligacion, pagadoObligacion, obligacionesActivas } from "@/lib/domain/ledger"

// Consultas de lectura compartidas por varias pantallas.

export function archivoHref(c: Pick<Comprobante, "id" | "archivo_url">): string | null {
  if (!c.archivo_url) return null
  return c.archivo_url === "demo" ? `/files/demo/${c.id}` : `/files/${c.archivo_url}`
}

export function detalleObligaciones(db: Db, usuarioId: string) {
  return obligacionesActivas(db, usuarioId)
    .map((o) => {
      const e = eventoDe(db, o)
      return { o, e, pagado: pagadoObligacion(db, o.id), saldo: saldoObligacion(db, o) }
    })
    .sort((a, b) => b.e.fecha_limite.localeCompare(a.e.fecha_limite))
}

export function comprobantesDe(db: Db, usuarioId: string) {
  return db.comprobantes
    .filter((c) => c.usuario_id === usuarioId)
    .sort((a, b) => b.fecha_carga.localeCompare(a.fecha_carga))
}

/** Desglose aplicado de un comprobante aceptado, con nombre de evento y regla. */
export function desgloseAplicado(db: Db, comprobanteId: string) {
  return db.pagos_aplicados
    .filter((p) => p.comprobante_id === comprobanteId)
    .map((p) => {
      const o = p.obligacion_id ? db.obligaciones.find((o) => o.id === p.obligacion_id) : null
      const evento = o ? db.eventos_cobro.find((e) => e.id === o.evento_cobro_id)?.nombre : null
      const regla = p.regla_aplicada ? db.reglas_conciliacion.find((r) => r.id === p.regla_aplicada)?.nombre : null
      return { ...p, evento: evento ?? "Saldo a favor", regla: regla ?? (p.obligacion_id ? "Ajuste manual" : "Sobrante") }
    })
}

export function progresoEvento(db: Db, eventoId: string) {
  const obligaciones = db.obligaciones.filter((o) => o.evento_cobro_id === eventoId)
  const recaudado = obligaciones.reduce((s, o) => s + pagadoObligacion(db, o.id), 0)
  const total = obligaciones.reduce((s, o) => s + o.monto, 0)
  return {
    pagados: obligaciones.filter((o) => o.estado === "pagado").length,
    total: obligaciones.length,
    recaudado,
    montoTotal: total,
  }
}

export function alcanceLabel(e: EventoCobro) {
  if (e.alcance === "todos") return "Todos"
  if (e.alcance === "grupo") return e.alcance_valor ?? ""
  return `${(e.alcance_valor ?? "").split(",").filter(Boolean).length} jugadores`
}
