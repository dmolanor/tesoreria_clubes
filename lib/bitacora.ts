// Parte pura del filtro de rango de fechas de la bitácora (lib/db/bitacora.ts la usa en la
// consulta). "Hasta" es inclusivo: cubre todo ese día, no solo su medianoche.

/** 'YYYY-MM-DD' → el día siguiente, también en 'YYYY-MM-DD'. Cruza mes y año. */
export function diaSiguiente(fecha: string): string {
  const [y, m, d] = fecha.slice(0, 10).split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}
