export type EstadoItemCalendario = "pagado" | "pendiente" | "estimado"

export interface ItemCalendario {
  dia: number | null
  nombre: string
  monto: number | null
  estado: EstadoItemCalendario
}

export interface MesCalendario {
  /** Primer día del mes, 'YYYY-MM-01'. */
  mes: string
  items: ItemCalendario[]
}

export interface EventoAgrupable {
  nombre: string
  tipo: string
  /** Fecha pura 'YYYY-MM-DD'. */
  fecha_limite: string
  /** Null cuando el miembro no tiene obligación en el evento. */
  obligacion: { monto: number; pagado: number } | null
}

/** Agrupa eventos por mes de su fecha límite; agrega mensualidad estimada donde falta. */
export function agruparPorMes(año: number, eventos: EventoAgrupable[], mensualidadEstimada: number | null): MesCalendario[] {
  const meses: MesCalendario[] = Array.from({ length: 12 }, (_, i) => ({
    mes: `${año}-${String(i + 1).padStart(2, "0")}-01`,
    items: [],
  }))
  const conMensualidad = new Set<number>()
  for (const e of eventos) {
    if (e.fecha_limite.slice(0, 4) !== String(año)) continue
    if (!e.obligacion) continue
    const idx = Number(e.fecha_limite.slice(5, 7)) - 1
    if (idx < 0 || idx > 11) continue
    if (e.tipo === "mensualidad") conMensualidad.add(idx)
    meses[idx].items.push({
      dia: Number(e.fecha_limite.slice(8, 10)),
      nombre: e.nombre,
      monto: e.obligacion.monto,
      estado: e.obligacion.pagado >= e.obligacion.monto ? "pagado" : "pendiente",
    })
  }
  for (let i = 0; i < 12; i++) {
    if (!conMensualidad.has(i)) {
      meses[i].items.push({ dia: null, nombre: "Mensualidad", monto: mensualidadEstimada, estado: "estimado" })
    }
    meses[i].items.sort((a, b) => (a.dia ?? 99) - (b.dia ?? 99))
  }
  return meses
}
