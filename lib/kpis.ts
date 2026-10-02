// Parte pura de los KPIs del inicio de tesorero/administrador — sin tocar la base, para poder
// probar el porcentaje y los casos borde con vitest. La parte que sí consulta Supabase vive en
// lib/db/kpis.ts (kpisClub).

import { rangoMes } from "./cuadre"

export interface RecaudoMes {
  /** Comprobantes aceptados cuya fecha de pago cae en el mes (mismo criterio que usa la conciliación). */
  recaudado: number
  /** Suma de `monto_total` de los eventos de cobro activos cuya fecha límite cae dentro del mes:
   *  lo que el club espera cobrar de esos eventos, sin importar cuándo se pagó cada obligación. */
  totalEsperado: number
  /** `recaudado / totalEsperado` redondeado; 0 si no hay nada esperado ese mes (no se divide entre 0). */
  pct: number
}

// numeric(14,2): se redondea a centavos para no arrastrar errores de punto flotante.
const centavos = (n: number) => Math.round(n * 100) / 100

/**
 * Relación de recaudo del mes para el KPI "$X de $Y (Z%)" del inicio de tesorero/admin.
 * Ver `RecaudoMes` para la definición exacta de cada término.
 */
export function recaudoMes(recaudado: number, totalEsperado: number): RecaudoMes {
  const r = centavos(recaudado)
  const t = centavos(totalEsperado)
  return { recaudado: r, totalEsperado: t, pct: t > 0 ? Math.round((r / t) * 100) : 0 }
}

/** true si la fecha límite de un evento cae dentro del mes ('YYYY-MM' o 'YYYY-MM-DD'). */
export function eventoDelMes(fechaLimite: string, mes: string): boolean {
  const { inicio, fin } = rangoMes(mes)
  return fechaLimite >= inicio && fechaLimite < fin
}
