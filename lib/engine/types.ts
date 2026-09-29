import type { TipoRegla } from "@/lib/data/types"

/** Obligación pendiente de un jugador, con saldo ya calculado. */
export interface PendingObligation {
  obligacion_id: string
  evento_cobro_id: string
  fecha_limite: string // YYYY-MM-DD
  saldo_pendiente: number
}

/** Subconjunto de `reglas_conciliacion` que el motor necesita. */
export interface EngineRule {
  id: string
  tipo: TipoRegla
  condicion: Record<string, unknown>
  prioridad: number
  activa: boolean
}

export interface ProposalLine {
  obligacion_id: string | null // null = saldo a favor
  monto_aplicado: number
  regla_aplicada: string | null
}

export interface Proposal {
  lineas: ProposalLine[]
  sobrante: number
}

/** Una regla recibe el restante y los pendientes (orden FIFO) y decide cuánto aplicar a cuál. */
export type RuleHandler = (args: {
  restante: number
  pendientes: readonly PendingObligation[]
  condicion: Record<string, unknown>
}) => Array<{ obligacion_id: string; monto: number }>
