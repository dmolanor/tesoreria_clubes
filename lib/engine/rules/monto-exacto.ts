import type { RuleHandler } from "../types"

/** Si el restante coincide exactamente con el saldo de una obligación, va ahí (la más antigua si hay varias). */
export const montoExacto: RuleHandler = ({ restante, pendientes }) => {
  const match = pendientes.find((o) => o.saldo_pendiente === restante)
  return match ? [{ obligacion_id: match.obligacion_id, monto: restante }] : []
}
