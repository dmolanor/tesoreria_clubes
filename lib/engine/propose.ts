import type { Enums } from "@/lib/data/database.types"
import type { EngineRule, PendingObligation, Proposal, ProposalLine, RuleHandler } from "./types"
import { montoExacto } from "./rules/monto-exacto"
import { eventoEspecifico } from "./rules/evento-especifico"
import { masAntiguoPrimero } from "./rules/mas-antiguo-primero"

type TipoRegla = Enums<"tipo_regla">

/** Catálogo cerrado de tipos (docs/03). Agregar un tipo = un handler + una entrada aquí. */
export const RULE_HANDLERS: Record<TipoRegla, RuleHandler> = {
  monto_exacto: montoExacto,
  evento_especifico: eventoEspecifico,
  mas_antiguo_primero: masAntiguoPrimero,
}

/**
 * Motor de conciliación: función pura. Evalúa las reglas activas en orden de
 * prioridad contra el restante del comprobante; lo que sobra va a saldo a favor.
 * El resultado es una *propuesta* — el tesorero puede editarla antes de aceptar.
 */
export function proposeAllocation(input: {
  monto: number
  pendientes: readonly PendingObligation[]
  reglas: readonly EngineRule[]
}): Proposal {
  const pendientes = [...input.pendientes]
    .filter((o) => o.saldo_pendiente > 0)
    .sort((a, b) => a.fecha_limite.localeCompare(b.fecha_limite))
    .map((o) => ({ ...o }))
  const reglas = input.reglas.filter((r) => r.activa).sort((a, b) => a.prioridad - b.prioridad)

  const lineas: ProposalLine[] = []
  let restante = input.monto

  for (const regla of reglas) {
    if (restante <= 0) break
    const handler = RULE_HANDLERS[regla.tipo]
    const vivos = pendientes.filter((o) => o.saldo_pendiente > 0)
    for (const { obligacion_id, monto } of handler({ restante, pendientes: vivos, condicion: regla.condicion })) {
      const target = pendientes.find((o) => o.obligacion_id === obligacion_id)
      // Defensa: un handler nunca puede aplicar más de lo que queda ni de lo que se debe.
      const aplicado = Math.min(monto, restante, target?.saldo_pendiente ?? 0)
      if (!target || aplicado <= 0) continue
      target.saldo_pendiente -= aplicado
      restante -= aplicado
      lineas.push({ obligacion_id, monto_aplicado: aplicado, regla_aplicada: regla.id })
    }
  }

  if (restante > 0) {
    lineas.push({ obligacion_id: null, monto_aplicado: restante, regla_aplicada: null })
  }
  return { lineas, sobrante: restante }
}
