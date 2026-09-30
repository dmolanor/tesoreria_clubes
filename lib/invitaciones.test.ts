import { describe, expect, it } from "vitest"
import { correoValido, esCorreoDemo, esCorreoSinCuenta, esCuentaExistente, normalizarCorreo, normalizarTelefono } from "./invitaciones"

describe("correo", () => {
  it("normaliza espacios y mayúsculas", () => {
    expect(normalizarCorreo("  Laura.Gomez@Gmail.COM ")).toBe("laura.gomez@gmail.com")
  })

  it("valida la forma básica", () => {
    expect(correoValido("a@b.co")).toBe(true)
    expect(correoValido("sin-arroba.com")).toBe(false)
    expect(correoValido("a @b.co")).toBe(false)
    expect(correoValido("a@b")).toBe(false)
  })

  it("reconoce las cuentas demo", () => {
    expect(esCorreoDemo("Laura@Example.com")).toBe(true)
    expect(esCorreoDemo("laura@example.com.co")).toBe(false)
  })
})

describe("normalizarTelefono", () => {
  it("agrega +57 a celulares y fijos colombianos", () => {
    expect(normalizarTelefono("300 123 4567")).toBe("+573001234567")
    expect(normalizarTelefono("(601) 234-5678")).toBe("+576012345678")
  })

  it("respeta el indicativo si viene", () => {
    expect(normalizarTelefono("+57 300 123 4567")).toBe("+573001234567")
    expect(normalizarTelefono("573001234567")).toBe("+573001234567")
    expect(normalizarTelefono("0034 612 345 678")).toBe("+34612345678")
    expect(normalizarTelefono("+1 (415) 555-0100")).toBe("+14155550100")
  })

  it("rechaza lo que no es un número", () => {
    expect(normalizarTelefono("")).toBeNull()
    expect(normalizarTelefono("12345")).toBeNull()
    expect(normalizarTelefono("+0 300")).toBeNull()
    expect(normalizarTelefono("llámame")).toBeNull()
  })
})

describe("errores de Supabase Auth", () => {
  it("correo sin cuenta con shouldCreateUser: false", () => {
    expect(esCorreoSinCuenta({ code: "otp_disabled", message: "Signups not allowed for otp" })).toBe(true)
    expect(esCorreoSinCuenta({ message: "Signups not allowed for otp" })).toBe(true)
    expect(esCorreoSinCuenta({ code: "over_email_send_rate_limit" })).toBe(false)
  })

  it("invitación a un correo que ya tiene cuenta", () => {
    expect(esCuentaExistente({ code: "email_exists" })).toBe(true)
    expect(esCuentaExistente({ message: "A user with this email address has already been registered" })).toBe(true)
    expect(esCuentaExistente({ code: "otp_disabled" })).toBe(false)
  })
})
