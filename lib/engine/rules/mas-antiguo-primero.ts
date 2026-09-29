import type { RuleHandler } from "../types"

/** FIFO por fecha límite; la última obligación que alcance queda en pago parcial. */
export const masAntiguoPrimero: RuleHandler = ({ restante, pendientes }) => {
  const out: Array<{ obligacion_id: string; monto: number }> = []
  let left = restante
  for (const o of pendientes) {
    if (left <= 0) break
    const monto = Math.min(left, o.saldo_pendiente)
    out.push({ obligacion_id: o.obligacion_id, monto })
    left -= monto
  }
  return out
}
