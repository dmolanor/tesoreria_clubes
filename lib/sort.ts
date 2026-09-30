export type SortDir = "asc" | "desc"

/**
 * Columna ordenable de una tabla. `value` devuelve texto (se compara en español, sin distinguir
 * tildes ni mayúsculas), número (montos, rangos de estado) o fecha ISO `YYYY-MM-DD` (orden
 * cronológico, que para ISO coincide con el orden de texto simple). `null`/`undefined` va al final.
 */
export interface SortColumn<T> {
  kind: "text" | "number" | "date"
  value: (row: T) => string | number | null | undefined
  /** Dirección del primer clic. Por defecto: A-Z para texto, cronológico para fechas, mayor a menor para números. */
  firstDir?: SortDir
  /** Cómo leer cada dirección en voz alta (lector de pantalla), p. ej. para rangos de estado. */
  dirText?: Record<SortDir, string>
}

export type SortColumns<T> = Record<string, SortColumn<T>>

export interface SortState {
  col: string
  dir: SortDir
}

const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true })

export function firstDirOf(column: Pick<SortColumn<unknown>, "kind" | "firstDir">): SortDir {
  return column.firstDir ?? (column.kind === "number" ? "desc" : "asc")
}

/** Lee `?orden=<col>&dir=asc|desc`. Columna desconocida → sin orden; dir inválida → la del primer clic. */
export function parseSort<T>(params: { orden?: string | string[]; dir?: string | string[] }, columns: SortColumns<T>): SortState | null {
  const col = typeof params.orden === "string" ? params.orden : null
  if (!col || !Object.hasOwn(columns, col)) return null
  const dir = params.dir === "asc" || params.dir === "desc" ? params.dir : firstDirOf(columns[col])
  return { col, dir }
}

/** Dirección que aplica un clic en `col`: invierte si ya está activa, si no la del primer clic. */
export function nextDir(current: SortState | null, col: string, column: Pick<SortColumn<unknown>, "kind" | "firstDir">): SortDir {
  if (current?.col === col) return current.dir === "asc" ? "desc" : "asc"
  return firstDirOf(column)
}

function compareValues(kind: SortColumn<unknown>["kind"], a: string | number, b: string | number): number {
  if (kind === "number") return Number(a) - Number(b)
  if (kind === "date") return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0
  return collator.compare(String(a), String(b))
}

/** Copia ordenada (estable: los empates conservan el orden de entrada). Los vacíos van al final en ambas direcciones. */
export function sortRows<T>(rows: readonly T[], columns: SortColumns<T>, state: SortState | null): T[] {
  const copy = [...rows]
  if (!state || !Object.hasOwn(columns, state.col)) return copy
  const { kind, value } = columns[state.col]
  const sign = state.dir === "asc" ? 1 : -1
  const empty = (v: unknown) => v === null || v === undefined || v === "" || (typeof v === "number" && Number.isNaN(v))
  return copy.sort((ra, rb) => {
    const a = value(ra)
    const b = value(rb)
    if (empty(a) || empty(b)) return empty(a) === empty(b) ? 0 : empty(a) ? 1 : -1
    return sign * compareValues(kind, a as string | number, b as string | number)
  })
}
