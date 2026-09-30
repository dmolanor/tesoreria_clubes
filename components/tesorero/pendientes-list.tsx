import Link from "next/link"
import type { ComprobantePendiente } from "@/lib/db/tesoreria"
import { formatCOP, formatFecha } from "@/lib/format"
import { ActionButton } from "@/components/action-button"
import { Button } from "@/components/ui/button"
import { aceptarPropuestaAction } from "@/app/actions/comprobantes"

/** Bandeja: cada fila trae la propuesta del motor y se acepta en 1 clic. */
export function PendientesList({
  items,
  reglas,
  limit,
  hideMore,
}: {
  items: ComprobantePendiente[]
  reglas: Map<string, string>
  limit?: number
  hideMore?: boolean
}) {
  if (items.length === 0) return <p className="text-muted-foreground">No hay comprobantes por revisar.</p>
  const visibles = limit ? items.slice(0, limit) : items

  return (
    <ul className="divide-y divide-border">
      {visibles.map((c) => {
        const evento = (oid: string | null) =>
          oid ? (c.pendientes.find((p) => p.obligacion_id === oid)?.evento ?? "?") : "Saldo a favor"
        return (
          <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold">
                {c.miembro} · <span className="tabular-nums">{formatCOP(c.monto)}</span>
              </p>
              <p className="text-[13px] text-muted-foreground">
                Pagó el {formatFecha(c.fecha_pago)} · subido el {formatFecha(c.created_at)}
                {c.canal !== "manual" ? ` · por ${c.canal === "whatsapp" ? "WhatsApp" : "Wompi"}` : ""}
              </p>
              {c.revision.requiere ? (
                <p className="mt-0.5 text-[13px] font-medium text-warn">Requiere tu revisión ({c.revision.motivos.join(" · ")})</p>
              ) : null}
              <ul className="mt-1 space-y-0.5 text-[13px]">
                {c.propuesta.lineas.map((l, i) => (
                  <li key={i}>
                    → {evento(l.obligacion_id)}: <span className="font-medium tabular-nums">{formatCOP(l.monto_aplicado)}</span>
                    {l.regla_aplicada ? <span className="text-muted-foreground"> ({reglas.get(l.regla_aplicada)})</span> : null}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button asChild variant="outline">
                <Link href={`/tesorero/comprobantes/${c.id}`}>Revisar</Link>
              </Button>
              <ActionButton action={aceptarPropuestaAction.bind(null, c.id)} className="bg-raza text-white hover:bg-raza/90">
                Aceptar
              </ActionButton>
            </div>
          </li>
        )
      })}
      {limit && items.length > limit && !hideMore ? (
        <li className="pt-3 text-[13px]">
          <Link href="/tesorero/comprobantes" className="underline underline-offset-2">
            Ver los {items.length} pendientes
          </Link>
        </li>
      ) : null}
    </ul>
  )
}
