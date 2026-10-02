import { describe, expect, it } from "vitest"
import { agruparPorMes, type EventoAgrupable, type TareaAgrupable } from "./calendario"

const HOY = "2026-06-15"

function evento(parcial: Partial<EventoAgrupable> & { fecha_limite: string }): EventoAgrupable {
  return { nombre: "Cobro", tipo: "otro", obligacion: { monto: 100_000, pagado: 0 }, ...parcial }
}

describe("agruparPorMes", () => {
  it("devuelve 12 meses cronológicos aunque no haya eventos ni tareas", () => {
    const meses = agruparPorMes(2026, HOY, [], null)
    expect(meses.map((m) => m.mes)).toEqual(Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}-01`))
    expect(meses.every((m) => m.tareas.length === 0)).toBe(true)
  })

  const ESTIMADO = { dia: null, nombre: "Mensualidad", monto: null, estado: "estimado" as const }

  it("muestra el saldo pendiente (no el monto total) cuando falta por pagar", () => {
    const meses = agruparPorMes(2026, HOY, [evento({ fecha_limite: "2026-07-05", obligacion: { monto: 90_000, pagado: 0 } })], null)
    expect(meses[6].items).toEqual([{ dia: 5, nombre: "Cobro", monto: 90_000, estado: "pendiente" }, ESTIMADO])
  })

  it("muestra el monto pagado cuando el cobro está pagado del todo", () => {
    const meses = agruparPorMes(2026, HOY, [evento({ fecha_limite: "2026-03-15", obligacion: { monto: 180_000, pagado: 180_000 } })], null)
    expect(meses[2].items).toEqual([{ dia: 15, nombre: "Cobro", monto: 180_000, estado: "pagado" }, ESTIMADO])
  })

  it("marca parcial cuando 0 < pagado < monto, y muestra el saldo restante", () => {
    const meses = agruparPorMes(2026, HOY, [evento({ nombre: "Uniforme", fecha_limite: "2026-09-05", obligacion: { monto: 90_000, pagado: 10_000 } })], null)
    expect(meses[8].items).toEqual([{ dia: 5, nombre: "Uniforme", monto: 80_000, estado: "parcial" }, ESTIMADO])
  })

  it("marca vencido cuando pasó la fecha límite y no se pagó nada", () => {
    const meses = agruparPorMes(2026, HOY, [evento({ nombre: "Cobro vencido", fecha_limite: "2026-05-05", obligacion: { monto: 120_000, pagado: 0 } })], null)
    expect(meses[4].items).toEqual([{ dia: 5, nombre: "Cobro vencido", monto: 120_000, estado: "vencido" }, ESTIMADO])
  })

  it("un abono no esconde la deuda vencida: con fecha pasada y saldo, queda vencido", () => {
    const meses = agruparPorMes(2026, HOY, [evento({ fecha_limite: "2026-01-05", obligacion: { monto: 100_000, pagado: 30_000 } })], null)
    expect(meses[0].items).toEqual([{ dia: 5, nombre: "Cobro", monto: 70_000, estado: "vencido" }, ESTIMADO])
  })

  it("agrega mensualidad estimada en meses sin mensualidad real, y ordena dia null al final", () => {
    const meses = agruparPorMes(2026, HOY, [evento({ nombre: "Mensualidad junio", tipo: "mensualidad", fecha_limite: "2026-06-10", obligacion: { monto: 100_000, pagado: 100_000 } })], 120_000)
    expect(meses[5].items).toEqual([{ dia: 10, nombre: "Mensualidad junio", monto: 100_000, estado: "pagado" }])
    expect(meses[0].items).toEqual([{ dia: null, nombre: "Mensualidad", monto: 120_000, estado: "estimado" }])
  })

  it("omite eventos de otro año y eventos sin obligación del miembro", () => {
    const meses = agruparPorMes(2026, HOY, [evento({ fecha_limite: "2025-12-10" }), evento({ fecha_limite: "2026-04-10", obligacion: null })], null)
    expect(meses[3].items).toEqual([{ dia: null, nombre: "Mensualidad", monto: null, estado: "estimado" }])
    expect(meses.flatMap((m) => m.items).filter((i) => i.dia !== null)).toEqual([])
  })

  it("agrupa las tareas por mes de su fecha límite, con su estado hecha/pendiente", () => {
    const tareas: TareaAgrupable[] = [
      { nombre: "Entrega de uniformes", fecha_limite: "2026-04-20", completada: false },
      { nombre: "Encuesta de la liga", fecha_limite: "2026-04-05", completada: true },
      { nombre: "Fuera de año", fecha_limite: "2025-04-01", completada: false },
    ]
    const meses = agruparPorMes(2026, HOY, [], null, tareas)
    expect(meses[3].tareas).toEqual([
      { dia: 5, nombre: "Encuesta de la liga", hecha: true },
      { dia: 20, nombre: "Entrega de uniformes", hecha: false },
    ])
    expect(meses.flatMap((m) => m.tareas)).toHaveLength(2)
  })
})
