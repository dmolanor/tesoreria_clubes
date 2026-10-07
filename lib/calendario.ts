export type EstadoItemCalendario = "pagado" | "vencido" | "pendiente" | "parcial" | "estimado"

export interface ItemCalendario {
  dia: number | null
  nombre: string
  /** Saldo pendiente, o el monto pagado cuando ya está pagado del todo. */
  monto: number | null
  estado: EstadoItemCalendario
}

export interface ItemTareaCalendario {
  dia: number
  nombre: string
  hecha: boolean
}

export interface MesCalendario {
  /** Primer día del mes, 'YYYY-MM-01'. */
  mes: string
  items: ItemCalendario[]
  tareas: ItemTareaCalendario[]
}

export interface EventoAgrupable {
  nombre: string
  tipo: string
  /** Fecha pura 'YYYY-MM-DD'. */
  fecha_limite: string
  /** Null cuando el miembro no tiene obligación en el evento. */
  obligacion: { monto: number; pagado: number } | null
}

export interface TareaAgrupable {
  nombre: string
  /** Fecha pura 'YYYY-MM-DD'. */
  fecha_limite: string
  completada: boolean
}

/** Agrupa eventos y tareas por mes; agrega mensualidad estimada donde falta. */
export function agruparPorMes(
  año: number,
  hoy: string,
  eventos: EventoAgrupable[],
  mensualidadEstimada: number | null,
  tareas: TareaAgrupable[] = [],
): MesCalendario[] {
  const meses: MesCalendario[] = Array.from({ length: 12 }, (_, i) => ({
    mes: `${año}-${String(i + 1).padStart(2, "0")}-01`,
    items: [],
    tareas: [],
  }))
  const conMensualidad = new Set<number>()
  for (const e of eventos) {
    if (e.fecha_limite.slice(0, 4) !== String(año)) continue
    if (!e.obligacion) continue
    const idx = Number(e.fecha_limite.slice(5, 7)) - 1
    if (idx < 0 || idx > 11) continue
    if (e.tipo === "mensualidad") conMensualidad.add(idx)
    const { monto, pagado } = e.obligacion
    const saldo = Math.max(0, monto - pagado)
    // Lo vencido con saldo es vencido aunque tenga abonos: es la deuda atrasada que la tesorería persigue.
    const estado: EstadoItemCalendario = saldo === 0 ? "pagado" : e.fecha_limite < hoy ? "vencido" : pagado > 0 ? "parcial" : "pendiente"
    meses[idx].items.push({ dia: Number(e.fecha_limite.slice(8, 10)), nombre: e.nombre, monto: saldo === 0 ? monto : saldo, estado })
  }
  for (const t of tareas) {
    if (t.fecha_limite.slice(0, 4) !== String(año)) continue
    const idx = Number(t.fecha_limite.slice(5, 7)) - 1
    if (idx < 0 || idx > 11) continue
    meses[idx].tareas.push({ dia: Number(t.fecha_limite.slice(8, 10)), nombre: t.nombre, hecha: t.completada })
  }
  for (let i = 0; i < 12; i++) {
    if (!conMensualidad.has(i)) {
      meses[i].items.push({ dia: null, nombre: "Mensualidad", monto: mensualidadEstimada, estado: "estimado" })
    }
    meses[i].items.sort((a, b) => (a.dia ?? 99) - (b.dia ?? 99))
    meses[i].tareas.sort((a, b) => a.dia - b.dia)
  }
  return meses
}
