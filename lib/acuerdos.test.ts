import { describe, expect, it } from "vitest"
import { estadoCuotas } from "./acuerdos"

const cuotas = [
  { numero: 1, fecha: "2026-10-05", monto: 60000 },
  { numero: 2, fecha: "2026-10-15", monto: 60000 },
  { numero: 3, fecha: "2026-10-25", monto: 60000 },
]

describe("estadoCuotas", () => {
  it("sin pagos nada queda cubierto", () => {
    expect(estadoCuotas(0, cuotas).map((c) => c.cubierta)).toEqual([false, false, false])
  })

  it("cubre en orden acumulado", () => {
    expect(estadoCuotas(60000, cuotas).map((c) => c.cubierta)).toEqual([true, false, false])
    expect(estadoCuotas(119999, cuotas).map((c) => c.cubierta)).toEqual([true, false, false])
    expect(estadoCuotas(120000, cuotas).map((c) => c.cubierta)).toEqual([true, true, false])
  })

  it("con el total (o más) todo queda cubierto", () => {
    expect(estadoCuotas(180000, cuotas).every((c) => c.cubierta)).toBe(true)
    expect(estadoCuotas(250000, cuotas).every((c) => c.cubierta)).toBe(true)
  })

  it("ordena por numero antes de acumular", () => {
    const reves = [...cuotas].reverse()
    expect(estadoCuotas(60000, reves).map((c) => [c.numero, c.cubierta])).toEqual([
      [1, true],
      [2, false],
      [3, false],
    ])
  })
})
