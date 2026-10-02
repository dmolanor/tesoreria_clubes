import { cn } from "@/lib/utils"

/**
 * Etiqueta neutra para la categoría de un jugador o evento ("Élite", "Project"). Borde gris,
 * texto pequeño, sin color — no compite con los estados (al día/pendiente/mora), que son los
 * únicos que usan forma + el acento en DESIGN.md.
 */
export function CategoriaTag({ categoria, className }: { categoria: string | null | undefined; className?: string }) {
  if (!categoria) return null
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[13px] font-medium text-muted-foreground",
        className,
      )}
    >
      {categoria}
    </span>
  )
}
