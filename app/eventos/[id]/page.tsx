import Link from "next/link"
import { notFound } from "next/navigation"
import { getStore } from "@/lib/data"
import { pageSession } from "@/lib/auth/page"
import { nombreUsuario, pagadoObligacion } from "@/lib/domain/ledger"
import { alcanceLabel, progresoEvento } from "@/lib/views"
import { formatCOP, formatFecha, hoyISO, relativoVencimiento } from "@/lib/format"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ProgressBar } from "@/components/progress-bar"
import { StatusDot } from "@/components/status-dot"
import { ActionButton } from "@/components/action-button"
import { EditarEvento } from "@/components/admin/editar-evento"
import { cancelarEventoAction } from "@/app/actions/eventos"

export default async function EventoDetalle(props: PageProps<"/eventos/[id]">) {
  const s = await pageSession("administrativo", "tesorero")
  const { id } = await props.params
  const db = await getStore().read()
  const e = db.eventos_cobro.find((e) => e.id === id && e.club_id === s.club_id)
  if (!e) notFound()
  const hoy = hoyISO()
  const p = progresoEvento(db, e.id)
  const esAdmin = s.roles.includes("administrativo")
  const filas = db.obligaciones
    .filter((o) => o.evento_cobro_id === e.id)
    .map((o) => ({ o, pagado: pagadoObligacion(db, o.id), nombre: nombreUsuario(db, o.usuario_id) }))
    .sort((a, b) => a.pagado / a.o.monto - b.pagado / b.o.monto || a.nombre.localeCompare(b.nombre))

  return (
    <div className="space-y-6">
      <Link href={esAdmin ? "/eventos" : "/tesorero"} className="text-[13px] text-muted-foreground hover:underline">
        ← {esAdmin ? "Eventos de cobro" : "Inicio"}
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>
            {e.nombre} {e.estado === "cancelado" ? <span className="text-[13px] font-medium text-muted-foreground">(cancelado)</span> : null}
          </CardTitle>
          <CardDescription>
            {formatCOP(e.monto)} por jugador · {alcanceLabel(e)} · vence {formatFecha(e.fecha_limite)} ({relativoVencimiento(e.fecha_limite, hoy)})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProgressBar value={p.pagados} total={p.total} />
          <p className="text-[13px] text-muted-foreground">
            {formatCOP(p.recaudado)} recaudados de {formatCOP(p.montoTotal)}
          </p>
          {esAdmin && e.estado === "activo" ? (
            <div className="flex flex-wrap items-start gap-2">
              <EditarEvento id={e.id} nombre={e.nombre} fecha_limite={e.fecha_limite} />
              <ActionButton variant="ghost" confirm="Confirmar cancelación — lo pagado pasa a saldo a favor" action={cancelarEventoAction.bind(null, e.id)}>
                Cancelar evento
              </ActionButton>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Por jugador</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jugador</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Pagado</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map(({ o, pagado, nombre }) => {
                const saldo = Math.max(0, o.monto - pagado)
                return (
                  <TableRow key={o.id}>
                    <TableCell>
                      <StatusDot estado={saldo === 0 ? "al_dia" : e.fecha_limite < hoy ? "mora" : "pendiente"} className="mr-2" />
                      <Link href={`/jugadores/${o.usuario_id}`} className="hover:underline">
                        {nombre}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCOP(o.monto)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCOP(pagado)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{saldo === 0 ? "—" : formatCOP(saldo)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
