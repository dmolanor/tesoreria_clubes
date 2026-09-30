import type { Proposal } from "./engine/types"

/**
 * Decide si un comprobante pendiente requiere revisión humana en vez de
 * aceptarse tal cual. El tesorero ve estos casos primero en la bandeja.
 */
export function necesitaHumano(input: {
  pendientes: number
  propuesta: Proposal
  canal: string
  extraccion: unknown
}): { requiere: boolean; motivos: string[] } {
  const motivos: string[] = []
  if (input.pendientes === 0) motivos.push("sin deudas activas")
  const aObligaciones = input.propuesta.lineas.filter((l) => l.obligacion_id && l.monto_aplicado > 0)
  if (input.pendientes > 0 && aObligaciones.length === 0) motivos.push("el monto no calza con ninguna deuda")
  if (input.canal === "whatsapp" && input.extraccion == null) motivos.push("sin lectura automática")
  const confianza = (input.extraccion as { confianza?: unknown } | null)?.confianza
  if (typeof confianza === "number" && confianza < 0.7) motivos.push("lectura automática dudosa")
  return { requiere: motivos.length > 0, motivos }
}
