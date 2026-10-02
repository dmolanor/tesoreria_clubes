import type { EgresoMes } from "@/lib/db/egresos"
import { CATEGORIA_EGRESO_LABEL } from "@/lib/db/types"
import { formatCOP, formatFecha } from "@/lib/format"
import { ActionButton } from "@/components/action-button"
import { anularEgresoAction } from "@/app/actions/egresos"
import { cn } from "@/lib/utils"

/** Egresos del mes. Los anulados se quedan a la vista (tachados) pero no suman en el cuadre;
 * los de un cruce tampoco suman y no se anulan sueltos (se anulan con la compensación). */
export function EgresosList({ items, soportes }: { items: EgresoMes[]; soportes: Map<string, string> }) {
  if (items.length === 0) return <p className="text-muted-foreground">No hay egresos registrados este mes.</p>
  return (
    <ul className="divide-y divide-border">
      {items.map((e) => {
        const anulado = !!e.anulado_en
        const esCruce = !!e.comprobante_id
        const href = e.soporte_path ? soportes.get(e.soporte_path) : undefined
        const categoria = e.categoria === "otros" && e.categoria_otro ? `${CATEGORIA_EGRESO_LABEL[e.categoria]}: ${e.categoria_otro}` : CATEGORIA_EGRESO_LABEL[e.categoria]
        return (
          <li key={e.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className={cn("min-w-0", anulado && "text-faint")}>
              <p className="text-[15px] font-semibold">
                <span className={cn(anulado && "line-through")}>
                  {e.concepto} · <span className="tabular-nums">{formatCOP(e.monto)}</span>
                </span>
                {anulado ? <span className="ml-2 text-[13px] font-medium">Anulado</span> : null}
                {esCruce ? <span className="ml-2 text-[13px] font-medium text-raza">Cruce</span> : null}
              </p>
              <p className="text-[13px] text-muted-foreground">
                {categoria} · {formatFecha(e.fecha)}
                {e.evento ? <> · {e.evento}</> : null}
                {href ? (
                  <>
                    {" · "}
                    <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-raza focus-visible:outline-none">
                      Ver soporte
                    </a>
                  </>
                ) : null}
              </p>
            </div>
            {anulado || esCruce ? null : (
              <ActionButton action={anularEgresoAction.bind(null, e.id)} variant="outline" confirm="¿Anular este egreso?" className="shrink-0">
                Anular
              </ActionButton>
            )}
          </li>
        )
      })}
    </ul>
  )
}
