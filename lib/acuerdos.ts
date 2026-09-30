/** Estado de cada cuota derivado de lo pagado en la obligación (no se guarda). */
export interface CuotaBase {
  numero: number
  fecha: string
  monto: number
}

/**
 * Una cuota queda cubierta cuando lo pagado alcanza la suma acumulada hasta ella.
 * Las cuotas se evalúan en orden de numero.
 */
export function estadoCuotas<T extends CuotaBase>(pagado: number, cuotas: readonly T[]): Array<T & { cubierta: boolean }> {
  const ordenadas = [...cuotas].sort((a, b) => a.numero - b.numero)
  let acumulado = 0
  return ordenadas.map((c) => {
    acumulado += c.monto
    return { ...c, cubierta: pagado >= acumulado }
  })
}
