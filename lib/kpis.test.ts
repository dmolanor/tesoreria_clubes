import { describe, expect, it } from "vitest"
import { eventoDelMes, recaudoMes } from "./kpis"

describe("recaudoMes", () => {
  it("calcula el porcentaje recaudado sobre lo esperado", () => {
    expect(recaudoMes(2_400_000, 3_200_000)).toEqual({ recaudado: 2_400_000, totalEsperado: 3_200_000, pct: 75 })
  })

  it("redondea el porcentaje al entero más cercano", () => {
    expect(recaudoMes(1, 3).pct).toBe(33)
    expect(recaudoMes(2, 3).pct).toBe(67)
  })

  it("sin nada esperado ese mes, el porcentaje es 0 (no se divide entre 0)", () => {
    expect(recaudoMes(500_000, 0)).toEqual({ recaudado: 500_000, totalEsperado: 0, pct: 0 })
  })

  it("puede superar el 100% si se recaudó más de lo esperado del mes (pagos adelantados)", () => {
    expect(recaudoMes(4_000_000, 3_200_000).pct).toBe(125)
  })

  it("sin nada recaudado, el porcentaje es 0", () => {
    expect(recaudoMes(0, 3_200_000).pct).toBe(0)
  })

  it("redondea a centavos (numeric(14,2))", () => {
    expect(recaudoMes(0.1 + 0.2, 1).recaudado).toBe(0.3)
  })
})

describe("eventoDelMes", () => {
  it("es del mes si la fecha límite cae dentro de él", () => {
    expect(eventoDelMes("2026-09-15", "2026-09-01")).toBe(true)
    expect(eventoDelMes("2026-09-01", "2026-09")).toBe(true)
    expect(eventoDelMes("2026-09-30", "2026-09")).toBe(true)
  })

  it("no es del mes si la fecha límite es de otro mes", () => {
    expect(eventoDelMes("2026-08-31", "2026-09-01")).toBe(false)
    expect(eventoDelMes("2026-10-01", "2026-09-01")).toBe(false)
  })

  it("cruza el año en diciembre", () => {
    expect(eventoDelMes("2026-12-31", "2026-12")).toBe(true)
    expect(eventoDelMes("2027-01-01", "2026-12")).toBe(false)
  })
})
