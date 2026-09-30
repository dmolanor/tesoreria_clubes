import { describe, expect, it } from "vitest"
import { necesitaHumano } from "./revision"

const propuestaLimpia = { lineas: [{ obligacion_id: "o1", monto_aplicado: 100000, regla_aplicada: "r1" }], sobrante: 0 }
const propuestaAfavor = { lineas: [{ obligacion_id: null, monto_aplicado: 50000, regla_aplicada: null }], sobrante: 50000 }

describe("necesitaHumano", () => {
  it("un caso limpio no requiere revisión", () => {
    expect(necesitaHumano({ pendientes: 2, propuesta: propuestaLimpia, canal: "manual", extraccion: null })).toEqual({
      requiere: false,
      motivos: [],
    })
  })

  it("sin deudas activas requiere revisión", () => {
    expect(necesitaHumano({ pendientes: 0, propuesta: propuestaAfavor, canal: "manual", extraccion: null }).motivos).toContain(
      "sin deudas activas",
    )
  })

  it("si nada calza con las deudas requiere revisión", () => {
    expect(necesitaHumano({ pendientes: 2, propuesta: propuestaAfavor, canal: "manual", extraccion: null }).motivos).toContain(
      "el monto no calza con ninguna deuda",
    )
  })

  it("whatsapp sin lectura automática requiere revisión", () => {
    expect(necesitaHumano({ pendientes: 1, propuesta: propuestaLimpia, canal: "whatsapp", extraccion: null }).motivos).toContain(
      "sin lectura automática",
    )
  })

  it("confianza baja de OCR requiere revisión", () => {
    const r = necesitaHumano({ pendientes: 1, propuesta: propuestaLimpia, canal: "whatsapp", extraccion: { confianza: 0.4 } })
    expect(r.motivos).toContain("lectura automática dudosa")
    const ok = necesitaHumano({ pendientes: 1, propuesta: propuestaLimpia, canal: "whatsapp", extraccion: { confianza: 0.95 } })
    expect(ok.requiere).toBe(false)
  })
})
