import { describe, expect, it } from "vitest"
import { cuadreMes, rangoMes } from "./cuadre"

describe("cuadreMes", () => {
  it("cuadra cuando el banco se movió lo mismo que ingresos − egresos", () => {
    expect(cuadreMes({ ingresos: 5_345_000, egresos: 1_650_000, saldoInicial: 8_770_000, saldoFinal: 12_465_000 })).toEqual({
      ingresos: 5_345_000,
      egresos: 1_650_000,
      esperado: 3_695_000,
      banco: 3_695_000,
      diferencia: 0,
    })
  })

  it("diferencia negativa si en el banco hay menos de lo esperado (ej. comisión bancaria)", () => {
    const c = cuadreMes({ ingresos: 1_000_000, egresos: 300_000, saldoInicial: 2_000_000, saldoFinal: 2_685_000 })
    expect(c.esperado).toBe(700_000)
    expect(c.banco).toBe(685_000)
    expect(c.diferencia).toBe(-15_000)
  })

  it("diferencia positiva si falta registrar un ingreso", () => {
    expect(cuadreMes({ ingresos: 0, egresos: 0, saldoInicial: 100, saldoFinal: 180_100 }).diferencia).toBe(180_000)
  })

  it("el esperado puede ser negativo en un mes de más egresos que ingresos", () => {
    const c = cuadreMes({ ingresos: 200_000, egresos: 1_200_000, saldoInicial: 3_000_000, saldoFinal: 2_000_000 })
    expect(c.esperado).toBe(-1_000_000)
    expect(c.diferencia).toBe(0)
  })

  it("sin saldo final no hay movimiento del banco ni diferencia", () => {
    const c = cuadreMes({ ingresos: 500_000, egresos: 100_000, saldoInicial: 1_000_000, saldoFinal: null })
    expect(c).toEqual({ ingresos: 500_000, egresos: 100_000, esperado: 400_000, banco: null, diferencia: null })
  })

  it("redondea a centavos (numeric(14,2))", () => {
    expect(cuadreMes({ ingresos: 0.1 + 0.2, egresos: 0, saldoInicial: 0, saldoFinal: 0.3 }).diferencia).toBe(0)
  })
})

describe("rangoMes", () => {
  it("devuelve el primer día del mes y el del siguiente", () => {
    expect(rangoMes("2026-09-01")).toEqual({ inicio: "2026-09-01", fin: "2026-10-01" })
    expect(rangoMes("2026-09-17")).toEqual({ inicio: "2026-09-01", fin: "2026-10-01" })
  })

  it("cruza el año en diciembre", () => {
    expect(rangoMes("2026-12")).toEqual({ inicio: "2026-12-01", fin: "2027-01-01" })
  })
})
