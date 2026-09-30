import { describe, expect, it } from "vitest"
import { cuadraConPendientes, diferenciaConPendientes, evaluarAprobableEnLote } from "./aprobacion-lote"

const base = { miembro_identificado: true, monto: 180_000 }

describe("evaluarAprobableEnLote", () => {
  it("aprueba cuando la propuesta del motor cubre todo el monto con deudas", () => {
    const propuesta = {
      lineas: [
        { obligacion_id: "o-jul", monto_aplicado: 120_000, regla_aplicada: "r-fifo" },
        { obligacion_id: "o-ago", monto_aplicado: 60_000, regla_aplicada: "r-fifo" },
      ],
      sobrante: 0,
    }
    expect(evaluarAprobableEnLote({ ...base, propuesta })).toEqual({ aprobable: true })
  })

  it("deja para revisión un comprobante sin jugador identificado", () => {
    const propuesta = { lineas: [{ obligacion_id: "o", monto_aplicado: 180_000, regla_aplicada: "r" }], sobrante: 0 }
    expect(evaluarAprobableEnLote({ ...base, miembro_identificado: false, propuesta })).toEqual({ aprobable: false, motivo: "sin_miembro" })
  })

  it("deja para revisión una propuesta vacía", () => {
    expect(evaluarAprobableEnLote({ ...base, propuesta: { lineas: [], sobrante: 0 } })).toEqual({ aprobable: false, motivo: "sin_propuesta" })
  })

  it("si el jugador no debe nada, todo iría a saldo a favor: es propuesta vacía", () => {
    const propuesta = { lineas: [{ obligacion_id: null, monto_aplicado: 180_000, regla_aplicada: null }], sobrante: 180_000 }
    expect(evaluarAprobableEnLote({ ...base, propuesta })).toEqual({ aprobable: false, motivo: "sin_propuesta" })
  })

  it("deja para revisión si una parte iría a saldo a favor", () => {
    const propuesta = {
      lineas: [
        { obligacion_id: "o", monto_aplicado: 120_000, regla_aplicada: "r" },
        { obligacion_id: null, monto_aplicado: 60_000, regla_aplicada: null },
      ],
      sobrante: 60_000,
    }
    expect(evaluarAprobableEnLote({ ...base, propuesta })).toEqual({ aprobable: false, motivo: "saldo_a_favor" })
  })

  it("deja para revisión si hay sobrante aunque no venga como línea", () => {
    const propuesta = { lineas: [{ obligacion_id: "o", monto_aplicado: 120_000, regla_aplicada: "r" }], sobrante: 60_000 }
    expect(evaluarAprobableEnLote({ ...base, propuesta })).toEqual({ aprobable: false, motivo: "saldo_a_favor" })
  })

  it("deja para revisión si las líneas no suman el monto", () => {
    const propuesta = { lineas: [{ obligacion_id: "o", monto_aplicado: 120_000, regla_aplicada: "r" }], sobrante: 0 }
    expect(evaluarAprobableEnLote({ ...base, propuesta })).toEqual({ aprobable: false, motivo: "monto_sin_aplicar" })
  })

  it("compara en centavos, sin errores de punto flotante", () => {
    const propuesta = {
      lineas: [
        { obligacion_id: "a", monto_aplicado: 0.1, regla_aplicada: "r" },
        { obligacion_id: "b", monto_aplicado: 0.2, regla_aplicada: "r" },
      ],
      sobrante: 0,
    }
    expect(evaluarAprobableEnLote({ ...base, monto: 0.3, propuesta })).toEqual({ aprobable: true })
  })
})

describe("cuadre con pendientes", () => {
  it("cuadra cuando la diferencia del mes es exactamente lo pendiente", () => {
    expect(diferenciaConPendientes({ diferencia: 360_000, totalPendiente: 360_000 })).toBe(0)
    expect(cuadraConPendientes({ diferencia: 360_000, totalPendiente: 360_000, pendientes: 3 })).toBe(true)
  })

  it("no cuadra si falta o sobra plata en el banco", () => {
    expect(diferenciaConPendientes({ diferencia: 350_000, totalPendiente: 360_000 })).toBe(-10_000)
    expect(cuadraConPendientes({ diferencia: 350_000, totalPendiente: 360_000, pendientes: 3 })).toBe(false)
    expect(cuadraConPendientes({ diferencia: 0, totalPendiente: 360_000, pendientes: 3 })).toBe(false)
  })

  it("sin pendientes no hay nada que aprobar aunque el mes cuadre", () => {
    expect(cuadraConPendientes({ diferencia: 0, totalPendiente: 0, pendientes: 0 })).toBe(false)
  })
})
