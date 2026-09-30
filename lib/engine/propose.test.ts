import { describe, expect, it } from "vitest"
import { proposeAllocation } from "./propose"
import type { EngineRule, PendingObligation } from "./types"

const julio: PendingObligation = { obligacion_id: "o-jul", evento_cobro_id: "e-jul", fecha_limite: "2026-07-10", saldo_pendiente: 120_000 }
const agosto: PendingObligation = { obligacion_id: "o-ago", evento_cobro_id: "e-ago", fecha_limite: "2026-08-10", saldo_pendiente: 120_000 }
const torneo: PendingObligation = { obligacion_id: "o-tor", evento_cobro_id: "e-tor", fecha_limite: "2026-09-20", saldo_pendiente: 180_000 }

const exacto: EngineRule = { id: "r-exacto", tipo: "monto_exacto", condicion: {}, prioridad: 1, activa: true }
const fifo: EngineRule = { id: "r-fifo", tipo: "mas_antiguo_primero", condicion: {}, prioridad: 2, activa: true }
const defaults = [exacto, fifo]

describe("proposeAllocation", () => {
  it("aplica al torneo cuando el monto coincide exactamente, aunque haya mensualidades más viejas", () => {
    const p = proposeAllocation({ monto: 180_000, pendientes: [julio, agosto, torneo], reglas: defaults })
    expect(p.lineas).toEqual([{ obligacion_id: "o-tor", monto_aplicado: 180_000, regla_aplicada: "r-exacto" }])
    expect(p.sobrante).toBe(0)
  })

  it("con monto_exacto desactivado, el mismo pago va FIFO", () => {
    const p = proposeAllocation({
      monto: 180_000,
      pendientes: [torneo, agosto, julio],
      reglas: [{ ...exacto, activa: false }, fifo],
    })
    expect(p.lineas).toEqual([
      { obligacion_id: "o-jul", monto_aplicado: 120_000, regla_aplicada: "r-fifo" },
      { obligacion_id: "o-ago", monto_aplicado: 60_000, regla_aplicada: "r-fifo" },
    ])
  })

  it("cubre una obligación y media, dejando la segunda en parcial", () => {
    const p = proposeAllocation({ monto: 180_000, pendientes: [julio, agosto], reglas: defaults })
    expect(p.lineas.map((l) => [l.obligacion_id, l.monto_aplicado])).toEqual([
      ["o-jul", 120_000],
      ["o-ago", 60_000],
    ])
  })

  it("el sobrepago va a saldo a favor", () => {
    const p = proposeAllocation({ monto: 150_000, pendientes: [julio], reglas: defaults })
    expect(p.lineas).toEqual([
      { obligacion_id: "o-jul", monto_aplicado: 120_000, regla_aplicada: "r-fifo" },
      { obligacion_id: null, monto_aplicado: 30_000, regla_aplicada: null },
    ])
    expect(p.sobrante).toBe(30_000)
  })

  it("sin obligaciones pendientes, todo queda como saldo a favor", () => {
    const p = proposeAllocation({ monto: 50_000, pendientes: [], reglas: defaults })
    expect(p.lineas).toEqual([{ obligacion_id: null, monto_aplicado: 50_000, regla_aplicada: null }])
  })

  it("combina evento_especifico con FIFO: el restante fluye a la siguiente regla", () => {
    const especifico: EngineRule = {
      id: "r-torneo",
      tipo: "evento_especifico",
      condicion: { evento_id: "e-tor" },
      prioridad: 1,
      activa: true,
    }
    const p = proposeAllocation({
      monto: 250_000,
      pendientes: [julio, torneo],
      reglas: [especifico, { ...exacto, prioridad: 2 }, { ...fifo, prioridad: 3 }],
    })
    expect(p.lineas).toEqual([
      { obligacion_id: "o-tor", monto_aplicado: 180_000, regla_aplicada: "r-torneo" },
      { obligacion_id: "o-jul", monto_aplicado: 70_000, regla_aplicada: "r-fifo" },
    ])
  })

  it("monto_exacto se evalúa sobre el restante tras reglas previas", () => {
    const especifico: EngineRule = {
      id: "r-torneo",
      tipo: "evento_especifico",
      condicion: { evento_id: "e-tor" },
      prioridad: 1,
      activa: true,
    }
    const p = proposeAllocation({
      monto: 300_000,
      pendientes: [julio, agosto, torneo],
      reglas: [especifico, { ...exacto, prioridad: 2 }, { ...fifo, prioridad: 3 }],
    })
    expect(p.lineas.map((l) => [l.obligacion_id, l.regla_aplicada])).toEqual([
      ["o-tor", "r-torneo"],
      ["o-jul", "r-exacto"],
    ])
  })

  it("respeta saldos parciales: ignora obligaciones con saldo 0", () => {
    const p = proposeAllocation({
      monto: 60_000,
      pendientes: [{ ...julio, saldo_pendiente: 0 }, { ...agosto, saldo_pendiente: 60_000 }],
      reglas: defaults,
    })
    expect(p.lineas).toEqual([{ obligacion_id: "o-ago", monto_aplicado: 60_000, regla_aplicada: "r-exacto" }])
  })
})
