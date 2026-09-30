import { describe, expect, it } from "vitest"
import { nextDir, parseSort, sortRows, type SortColumns } from "./sort"

interface Fila {
  nombre: string
  saldo: number | null
  vence: string | null
  estado: "activo" | "lesionado" | "retirado"
}

const RANGO = { activo: 0, lesionado: 1, retirado: 2 } as const

const columnas: SortColumns<Fila> = {
  nombre: { kind: "text", value: (f) => f.nombre },
  saldo: { kind: "number", value: (f) => f.saldo },
  vence: { kind: "date", value: (f) => f.vence },
  estado: { kind: "number", value: (f) => RANGO[f.estado], firstDir: "asc" },
}

const filas: Fila[] = [
  { nombre: "Ángela", saldo: 120_000, vence: "2026-09-10", estado: "lesionado" },
  { nombre: "andrés", saldo: -30_000, vence: "2026-07-01", estado: "activo" },
  { nombre: "Óscar", saldo: null, vence: null, estado: "retirado" },
  { nombre: "Beatriz", saldo: 0, vence: "2026-08-15", estado: "activo" },
  { nombre: "Zoe", saldo: 300_000, vence: "2026-10-01", estado: "lesionado" },
]

const nombres = (rows: Fila[]) => rows.map((f) => f.nombre)

describe("sortRows", () => {
  it("texto A-Z ignora tildes y mayúsculas", () => {
    expect(nombres(sortRows(filas, columnas, { col: "nombre", dir: "asc" }))).toEqual(["andrés", "Ángela", "Beatriz", "Óscar", "Zoe"])
  })

  it("texto Z-A es el inverso", () => {
    expect(nombres(sortRows(filas, columnas, { col: "nombre", dir: "desc" }))).toEqual(["Zoe", "Óscar", "Beatriz", "Ángela", "andrés"])
  })

  it("saldo de mayor a menor pone arriba la mayor deuda y abajo el saldo a favor; vacíos al final", () => {
    expect(nombres(sortRows(filas, columnas, { col: "saldo", dir: "desc" }))).toEqual(["Zoe", "Ángela", "Beatriz", "andrés", "Óscar"])
  })

  it("saldo de menor a mayor pone arriba el mayor saldo a favor; vacíos siguen al final", () => {
    expect(nombres(sortRows(filas, columnas, { col: "saldo", dir: "asc" }))).toEqual(["andrés", "Beatriz", "Ángela", "Zoe", "Óscar"])
  })

  it("fechas en orden cronológico", () => {
    expect(nombres(sortRows(filas, columnas, { col: "vence", dir: "asc" }))).toEqual(["andrés", "Beatriz", "Ángela", "Zoe", "Óscar"])
    expect(nombres(sortRows(filas, columnas, { col: "vence", dir: "desc" }))).toEqual(["Zoe", "Ángela", "Beatriz", "andrés", "Óscar"])
  })

  it("estado por rango, estable en empates (conserva el orden de entrada)", () => {
    expect(nombres(sortRows(filas, columnas, { col: "estado", dir: "asc" }))).toEqual(["andrés", "Beatriz", "Ángela", "Zoe", "Óscar"])
  })

  it("sin orden o con columna desconocida devuelve una copia en el orden original", () => {
    const r = sortRows(filas, columnas, null)
    expect(r).toEqual(filas)
    expect(r).not.toBe(filas)
    expect(sortRows(filas, columnas, { col: "nada", dir: "asc" })).toEqual(filas)
  })

  it("no muta la entrada", () => {
    const antes = [...filas]
    sortRows(filas, columnas, { col: "saldo", dir: "desc" })
    expect(filas).toEqual(antes)
  })
})

describe("parseSort", () => {
  it("lee columna y dirección válidas", () => {
    expect(parseSort({ orden: "saldo", dir: "asc" }, columnas)).toEqual({ col: "saldo", dir: "asc" })
  })

  it("ignora columnas desconocidas y valores repetidos", () => {
    expect(parseSort({ orden: "toString" }, columnas)).toBeNull()
    expect(parseSort({ orden: ["saldo", "nombre"] }, columnas)).toBeNull()
    expect(parseSort({}, columnas)).toBeNull()
  })

  it("con dir inválida usa la del primer clic: números de mayor a menor, texto A-Z", () => {
    expect(parseSort({ orden: "saldo", dir: "x" }, columnas)).toEqual({ col: "saldo", dir: "desc" })
    expect(parseSort({ orden: "nombre" }, columnas)).toEqual({ col: "nombre", dir: "asc" })
    expect(parseSort({ orden: "estado" }, columnas)).toEqual({ col: "estado", dir: "asc" })
  })
})

describe("nextDir", () => {
  it("invierte la columna activa y usa la del primer clic en las demás", () => {
    expect(nextDir({ col: "saldo", dir: "desc" }, "saldo", columnas.saldo)).toBe("asc")
    expect(nextDir({ col: "saldo", dir: "asc" }, "saldo", columnas.saldo)).toBe("desc")
    expect(nextDir({ col: "saldo", dir: "asc" }, "nombre", columnas.nombre)).toBe("asc")
    expect(nextDir(null, "saldo", columnas.saldo)).toBe("desc")
  })
})
