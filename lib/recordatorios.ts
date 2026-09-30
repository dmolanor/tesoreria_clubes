import { formatCOP, formatFecha } from "./format"

/** Mensaje grupal por categoría: tagea a cada deudor con lo que debe. */
export function mensajeGrupalMora(categoria: string, hoy: string, deudores: Array<{ nombre: string; deudas: string[] }>): string {
  const lineas = deudores.map((d) => `@${d.nombre}: ${d.deudas.join(", ")}`)
  return [`${categoria}, pendientes al ${formatFecha(hoy, true)}:`, ...lineas].join("\n")
}

/** Aviso de un cobro próximo a vencer con sus pendientes. */
export function mensajeVencimiento(evento: string, fechaLimite: string, monto: number, pendientes: string[]): string {
  const lineas = pendientes.map((p) => `@${p}`)
  return [`El ${formatFecha(fechaLimite)} vence ${evento} (${formatCOP(monto)}). Pendientes:`, ...lineas].join("\n")
}

/** Recordatorio individual de una cuota de acuerdo de pago. */
export function mensajeAcuerdo(nombre: string, evento: string, montoCuota: number, fechaCuota: string): string {
  return `Hola ${nombre}, el ${formatFecha(fechaCuota)} vence la cuota de ${formatCOP(montoCuota)} de tu acuerdo para ${evento}.`
}
