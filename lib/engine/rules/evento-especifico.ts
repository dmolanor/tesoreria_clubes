import type { RuleHandler } from "../types"

/** Cubre primero (total o parcialmente) la obligación del evento configurado. */
export const eventoEspecifico: RuleHandler = ({ restante, pendientes, condicion }) => {
  const eventoId = condicion.evento_id
  if (typeof eventoId !== "string") return []
  const target = pendientes.find((o) => o.evento_cobro_id === eventoId)
  if (!target) return []
  return [{ obligacion_id: target.obligacion_id, monto: Math.min(restante, target.saldo_pendiente) }]
}
