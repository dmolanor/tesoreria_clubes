// Cuadre de la conciliación mensual. Es la misma fórmula que la columna generada
// `conciliaciones.diferencia` (migración 20260930014028_egresos.sql):
//   diferencia = (saldo final − saldo inicial) − (ingresos aceptados − egresos no anulados)

export interface Cuadre {
  /** Comprobantes aceptados cuya fecha de pago cae en el mes. */
  ingresos: number
  /** Egresos no anulados cuya fecha cae en el mes. */
  egresos: number
  /** Lo que debería haberse movido la cuenta: ingresos − egresos. */
  esperado: number
  /** Movimiento real de la cuenta (saldo final − saldo inicial); null si aún no hay saldo final. */
  banco: number | null
  /** banco − esperado; 0 = cuadrada. null si aún no hay saldo final. */
  diferencia: number | null
}

// numeric(14,2): se redondea a centavos para no arrastrar errores de punto flotante.
const centavos = (n: number) => Math.round(n * 100) / 100

export function cuadreMes(input: { ingresos: number; egresos: number; saldoInicial: number; saldoFinal: number | null }): Cuadre {
  const esperado = centavos(input.ingresos - input.egresos)
  const banco = input.saldoFinal == null ? null : centavos(input.saldoFinal - input.saldoInicial)
  return {
    ingresos: centavos(input.ingresos),
    egresos: centavos(input.egresos),
    esperado,
    banco,
    diferencia: banco == null ? null : centavos(banco - esperado),
  }
}

/** '2026-09' o '2026-09-15' → { inicio: '2026-09-01', fin: '2026-10-01' } (fin exclusivo). */
export function rangoMes(mes: string): { inicio: string; fin: string } {
  const [y, m] = mes.slice(0, 7).split("-").map(Number)
  const inicio = `${mes.slice(0, 7)}-01`
  const fin = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10)
  return { inicio, fin }
}
