import { describe, expect, it } from "vitest"
import { agruparPorMes, type EventoAgrupable } from "./calendario"

function evento(parcial: Partial<EventoAgrupable> & { fecha_limite: string }): EventoAgrupable {
  return { nombre: "Cobro", tipo: "otro", obligacion: { monto: 100_000, pagado: 0 }, ...parcial }
}

describe("agruparPorMes", () => {
  it("devuelve 12 meses cronológicos aunque no haya eventos", () => {
    const meses = agruparPorMes(2026, [], null)
    expect(meses.map((m) => m.mes)).toEqual(Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}-01`))
  })

  it("agrupa por mes de fecha_limite con día y estado según la obligación", () => {
    const meses = agruparPorMes(
      2026,
      [
        evento({ nombre: "Torneo", tipo: "torneo", fecha_limite: "2026-03-15", obligacion: { monto: 180_000, pagado: 180_000 } }),
        evento({ nombre: "Uniforme", tipo: "uniforme", fecha_limite: "2026-03-05", obligacion: { monto: 90_000, pagado: 10_000 } }),
      ],
      120_000,
    )
    expect(meses[2].items).toEqual([
      { dia: 5, nombre: "Uniforme", monto: 90_000, estado: "pendiente" },
      { dia: 15, nombre: "Torneo", monto: 180_000, estado: "pagado" },
      { dia: null, nombre: "Mensualidad", monto: 120_000, estado: "estimado" },
    ])
  })

  it("no agrega estimada en meses con mensualidad real, y ordena dia null al final", () => {
    const meses = agruparPorMes(2026, [evento({ nombre: "Mensualidad junio", tipo: "mensualidad", fecha_limite: "2026-06-10" })], 120_000)
    expect(meses[5].items).toEqual([{ dia: 10, nombre: "Mensualidad junio", monto: 100_000, estado: "pendiente" }])
    expect(meses[0].items).toEqual([{ dia: null, nombre: "Mensualidad", monto: 120_000, estado: "estimado" }])
  })

  it("omite eventos de otro año y eventos sin obligación del miembro", () => {
    const meses = agruparPorMes(
      2026,
      [
        evento({ fecha_limite: "2025-12-10" }),
        evento({ fecha_limite: "2026-04-10", obligacion: null }),
      ],
      null,
    )
    expect(meses[3].items).toEqual([{ dia: null, nombre: "Mensualidad", monto: null, estado: "estimado" }])
    expect(meses.flatMap((m) => m.items).filter((i) => i.dia !== null)).toEqual([])
  })
})
