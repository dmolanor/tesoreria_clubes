import type { Proposal } from "@/lib/engine/types"

/**
 * Aprobación en lote desde Conciliación. Aquí solo se decide *si* un comprobante puede aceptarse
 * sin mirarlo: el desglose sigue siendo el que propone el motor de reglas del club, sin cambios.
 */

export type MotivoRevision = "requiere_revision" | "sin_miembro" | "sin_propuesta" | "saldo_a_favor" | "monto_sin_aplicar"

export const MOTIVO_REVISION: Record<MotivoRevision, string> = {
  requiere_revision: "la bandeja lo marcó para revisión",
  sin_miembro: "no se sabe de qué jugador es",
  sin_propuesta: "el motor no lo aplicó a ninguna deuda",
  saldo_a_favor: "dejaría saldo a favor",
  monto_sin_aplicar: "la propuesta no suma el monto del comprobante",
}

export type Aprobable = { aprobable: true } | { aprobable: false; motivo: MotivoRevision }

const centavos = (n: number) => Math.round(n * 100)

/**
 * Un comprobante es aprobable en lote solo si la propuesta del motor lo cubre completo:
 * jugador identificado, al menos una línea a una deuda, nada a saldo a favor y la suma de
 * líneas igual al monto. Tampoco entra lo que la bandeja marcó con `necesitaHumano`.
 * Cualquier otra cosa queda para revisión manual en Comprobantes.
 */
export function evaluarAprobableEnLote(c: {
  miembro_identificado: boolean
  monto: number
  propuesta: Proposal
  revision?: { requiere: boolean }
}): Aprobable {
  if (c.revision?.requiere) return { aprobable: false, motivo: "requiere_revision" }
  if (!c.miembro_identificado) return { aprobable: false, motivo: "sin_miembro" }
  const aDeudas = c.propuesta.lineas.filter((l) => l.obligacion_id && l.monto_aplicado > 0)
  if (c.monto <= 0 || aDeudas.length === 0) return { aprobable: false, motivo: "sin_propuesta" }
  const aFavor = c.propuesta.lineas.some((l) => !l.obligacion_id && l.monto_aplicado > 0)
  if (aFavor || centavos(c.propuesta.sobrante) > 0) return { aprobable: false, motivo: "saldo_a_favor" }
  const aplicado = aDeudas.reduce((s, l) => s + centavos(l.monto_aplicado), 0)
  if (aplicado !== centavos(c.monto)) return { aprobable: false, motivo: "monto_sin_aplicar" }
  return { aprobable: true }
}

/**
 * Diferencia del mes si se aceptaran los comprobantes pendientes de ese mes. Parte de la misma
 * diferencia que ya calcula la conciliación (movimiento del banco − aceptado) y le resta lo pendiente:
 * si da 0, el extracto respalda exactamente esos pendientes y aprobarlos deja el mes cuadrado.
 */
export function diferenciaConPendientes(r: { diferencia: number; totalPendiente: number }): number {
  return (centavos(r.diferencia) - centavos(r.totalPendiente)) / 100
}

/** El botón "Aprobar N comprobantes pendientes" aparece (y el servidor aprueba) solo en este caso. */
export function cuadraConPendientes(r: { diferencia: number; totalPendiente: number; pendientes: number }): boolean {
  return r.pendientes > 0 && centavos(diferenciaConPendientes(r)) === 0
}
