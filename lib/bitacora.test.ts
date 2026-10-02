import { describe, expect, it } from "vitest"
import { diaSiguiente } from "./bitacora"

describe("diaSiguiente", () => {
  it("devuelve el día siguiente", () => {
    expect(diaSiguiente("2026-09-15")).toBe("2026-09-16")
  })

  it("cruza de mes", () => {
    expect(diaSiguiente("2026-09-30")).toBe("2026-10-01")
  })

  it("cruza de año", () => {
    expect(diaSiguiente("2026-12-31")).toBe("2027-01-01")
  })

  it("respeta años bisiestos", () => {
    expect(diaSiguiente("2028-02-28")).toBe("2028-02-29")
    expect(diaSiguiente("2028-02-29")).toBe("2028-03-01")
  })
})
