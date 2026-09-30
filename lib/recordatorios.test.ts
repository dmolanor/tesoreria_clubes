import { describe, expect, it } from "vitest"
import { mensajeAcuerdo, mensajeGrupalMora, mensajeVencimiento } from "./recordatorios"
import { formatFecha } from "./format"

describe("mensajeGrupalMora", () => {
  it("tagea a cada deudor con sus deudas", () => {
    expect(
      mensajeGrupalMora("Élite", "2026-09-30", [
        { nombre: "Camila Ruiz", deudas: ["Mensualidad julio", "Team fee"] },
        { nombre: "Mateo López", deudas: ["Póliza"] },
      ]),
    ).toBe(
      `Élite, pendientes al ${formatFecha("2026-09-30", true)}:\n@Camila Ruiz: Mensualidad julio, Team fee\n@Mateo López: Póliza`,
    )
  })
})

describe("mensajeVencimiento", () => {
  it("nombra el evento, la fecha y los pendientes", () => {
    expect(mensajeVencimiento("Team fee", "2026-10-05", 180000, ["Ana Ruiz", "Luis Paz"])).toBe(
      `El ${formatFecha("2026-10-05")} vence Team fee ($180.000). Pendientes:\n@Ana Ruiz\n@Luis Paz`,
    )
  })
})

describe("mensajeAcuerdo", () => {
  it("dice fecha, monto acordado y evento", () => {
    expect(mensajeAcuerdo("Sara Gil", "Team fee", 60000, "2026-10-15")).toBe(
      `Hola Sara Gil, el ${formatFecha("2026-10-15")} vence la cuota de $60.000 de tu acuerdo para Team fee.`,
    )
  })
})
