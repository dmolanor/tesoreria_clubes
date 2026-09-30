import Link from "next/link"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { TableHead } from "@/components/ui/table"
import { nextDir, type SortColumn, type SortState } from "@/lib/sort"
import { cn } from "@/lib/utils"

const DIR_TEXTO = {
  text: { asc: "de la A a la Z", desc: "de la Z a la A" },
  number: { asc: "de menor a mayor", desc: "de mayor a menor" },
  date: { asc: "de la más antigua a la más reciente", desc: "de la más reciente a la más antigua" },
} as const

/**
 * Encabezado de tabla que ordena al hacer clic. Es un link a `?orden=<col>&dir=…` que conserva
 * los demás parámetros de la URL (p. ej. el filtro de categoría), así el orden sobrevive recargas.
 */
export function SortableHead({
  col,
  label,
  column,
  sort,
  pathname,
  params = {},
  align = "left",
  className,
}: {
  col: string
  label: string
  column: Pick<SortColumn<unknown>, "kind" | "firstDir" | "dirText">
  sort: SortState | null
  pathname: string
  /** Parámetros de la URL que se conservan al cambiar el orden. */
  params?: Record<string, string | undefined>
  align?: "left" | "right"
  className?: string
}) {
  const activo = sort?.col === col ? sort.dir : null
  const dir = nextDir(sort, col, column)
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v && k !== "orden" && k !== "dir") qs.set(k, v)
  qs.set("orden", col)
  qs.set("dir", dir)
  const Icono = activo === "asc" ? ArrowUp : activo === "desc" ? ArrowDown : ArrowUpDown

  return (
    <TableHead aria-sort={activo === "asc" ? "ascending" : activo === "desc" ? "descending" : "none"} className={cn(align === "right" && "text-right", className)}>
      <Link
        href={`${pathname}?${qs}`}
        scroll={false}
        className={cn(
          "-mx-2 inline-flex h-10 items-center gap-1 rounded-md px-2 transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-raza focus-visible:outline-none motion-reduce:transition-none",
          align === "right" && "flex-row-reverse",
          activo && "text-foreground",
        )}
      >
        {label}
        <Icono aria-hidden className={cn("size-3.5 shrink-0", !activo && "text-faint")} />
        <span className="sr-only">, ordenar {(column.dirText ?? DIR_TEXTO[column.kind])[dir]}</span>
      </Link>
    </TableHead>
  )
}
