import Link from "next/link"
import type { Db } from "@/lib/data/types"
import { nombreUsuario, propuestaPara } from "@/lib/domain/ledger"
import { formatCOP, formatFecha } from "@/lib/format"
import { ActionButton } from "@/components/action-button"
import { Button } from "@/components/ui/button"
import { aceptarPropuestaAction } from "@/app/actions/comprobantes"

/** Bandeja: cada fila trae la propuesta del motor y se acepta en 1 clic. */
export function PendientesList({ db, clubId, limit }: { db: Db; clubId: string; limit?: number }) {
  const club = new Set(db.usuarios.filter((u) => u.club_id === clubId).map((u) => u.id))
  const pendientes = db.comprobantes
    .filter((c) => c.estado === "pendiente" && club.has(c.usuario_id))
    .sort((a, b) => a.fecha_carga.localeCompare(b.fecha_carga))
  const visibles = limit ? pendientes.slice(0, limit) : pendientes

  if (pendientes.length === 0) {
    return <p className="text-muted-foreground">No hay comprobantes por revisar.</p>
  }

  const evento = (oid: string | null) => {
    if (!oid) return "Saldo a favor"
    const o = db.obligaciones.find((o) => o.id === oid)
    return db.eventos_cobro.find((e) => e.id === o?.evento_cobro_id)?.nombre ?? "?"
  }
  const regla = (rid: string | null) => db.reglas_conciliacion.find((r) => r.id === rid)?.nombre

  return (
    <ul className="divide-y divide-border">
      {visibles.map((c) => {
        const p = propuestaPara(db, c.id)
        return (
          <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold">
                {nombreUsuario(db, c.usuario_id)} · <span className="tabular-nums">{formatCOP(c.monto_total)}</span>
              </p>
              <p className="text-[13px] text-muted-foreground">Subido el {formatFecha(c.fecha_carga)}</p>
              <ul className="mt-1 space-y-0.5 text-[13px]">
                {p.lineas.map((l, i) => (
                  <li key={i}>
                    → {evento(l.obligacion_id)}: <span className="font-medium tabular-nums">{formatCOP(l.monto_aplicado)}</span>
                    {regla(l.regla_aplicada) ? <span className="text-muted-foreground"> ({regla(l.regla_aplicada)})</span> : null}
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
      {limit && pendientes.length > limit ? (
        <li className="pt-3 text-[13px]">
          <Link href="/tesorero/comprobantes" className="underline underline-offset-2">
            Ver los {pendientes.length} pendientes
          </Link>
        </li>
      ) : null}
    </ul>
  )
}
