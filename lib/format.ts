const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })

/** $180.000 */
export function formatCOP(n: number): string {
  return cop.format(n).replace(/\s/g, "")
}

const TZ = "America/Bogota"
const fechaDia = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
const fechaDiaCorta = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" })
const fechaHora = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: TZ })
const fechaHoraCorta = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: TZ })
const mesFmt = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" })

/** '2026-09-10' (fecha pura) o ISO datetime (se muestra en hora de Colombia) → '10 sept 2026' */
export function formatFecha(iso: string, corta = false): string {
  if (iso.length === 10) return (corta ? fechaDiaCorta : fechaDia).format(new Date(`${iso}T00:00:00Z`))
  return (corta ? fechaHoraCorta : fechaHora).format(new Date(iso))
}

export function formatMes(isoMes: string): string {
  const s = mesFmt.format(new Date(`${isoMes.slice(0, 7)}-01T00:00:00Z`))
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Fecha local de Colombia (YYYY-MM-DD). */
export function hoyISO(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now)
}

/** Día en Colombia (YYYY-MM-DD) de un ISO datetime guardado en UTC. */
export function diaLocal(isoDateTime: string): string {
  return hoyISO(new Date(isoDateTime))
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000)
}

/** "vence en 3 días", "venció hace 12 días", "vence hoy" */
export function relativoVencimiento(fechaLimite: string, hoy: string): string {
  const d = diasEntre(hoy, fechaLimite)
  if (d === 0) return "vence hoy"
  if (d === 1) return "vence mañana"
  if (d > 0) return `vence en ${d} días`
  return d === -1 ? "venció ayer" : `venció hace ${-d} días`
}

/** Acepta "180000", "180.000", "$180.000" → 180000. */
export function parseMonto(raw: FormDataEntryValue | null): number {
  const n = Number(String(raw ?? "").replace(/[^\d]/g, ""))
  return Number.isFinite(n) ? n : 0
}
