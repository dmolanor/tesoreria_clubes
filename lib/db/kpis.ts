import "server-only"
import type { Supabase } from "@/lib/supabase/server"
import { eventoDelMes, recaudoMes, type RecaudoMes } from "@/lib/kpis"
import { estadosDeCuenta } from "@/lib/db/cuenta"
import { conteoPendientes, totalAceptadoMes } from "@/lib/db/tesoreria"
import { eventosDelClub, progresoEventos } from "@/lib/db/admin"

export interface KpisClub {
  recaudo: RecaudoMes
  jugadoresEnMora: number
  montoEnMora: number
  /** Comprobantes pendientes de revisión del club (no se muestra en el inicio del admin: no los gestiona). */
  comprobantesPendientes: number
  /** Saldo a favor acumulado de todos los jugadores del club (crédito que ya pagaron y aún no se aplica). */
  saldoAFavorClub: number
}

/**
 * KPIs compartidos del inicio de tesorero y administrador. `mes` en formato 'YYYY-MM-01'.
 * Ver `lib/kpis.ts` (`recaudoMes`, `eventoDelMes`) para la definición exacta de cada término —
 * es la parte pura y testeable de este cálculo.
 */
export async function kpisClub(sb: Supabase, clubId: string, mes: string): Promise<KpisClub> {
  const [eventos, progreso, { total: recaudado }, comprobantesPendientes, cuentas] = await Promise.all([
    eventosDelClub(sb, clubId),
    progresoEventos(sb, clubId),
    totalAceptadoMes(sb, clubId, mes),
    conteoPendientes(sb, clubId),
    estadosDeCuenta(sb, clubId),
  ])
  const totalEsperado = eventos
    .filter((e) => e.estado === "activo" && eventoDelMes(e.fecha_limite, mes))
    .reduce((s, e) => s + (progreso.get(e.id)?.monto_total ?? 0), 0)
  const filas = [...cuentas.values()]
  const enMora = filas.filter((c) => c.estado === "mora")
  return {
    recaudo: recaudoMes(recaudado, totalEsperado),
    jugadoresEnMora: enMora.length,
    montoEnMora: enMora.reduce((s, c) => s + c.total_vencido, 0),
    comprobantesPendientes,
    saldoAFavorClub: filas.reduce((s, c) => s + c.saldo_a_favor, 0),
  }
}
