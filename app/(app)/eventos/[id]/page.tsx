import Link from "next/link"
import { notFound } from "next/navigation"
import { pageSession } from "@/lib/auth/page"
import { alcanceLabel, progresoEventos } from "@/lib/db/admin"
import { formatCOP, formatFecha, hoyISO, relativoVencimiento } from "@/lib/format"
import { TIPO_COBRO_LABEL } from "@/lib/db/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ProgressBar } from "@/components/progress-bar"
import { StatusDot } from "@/components/status-dot"
import { ActionButton } from "@/components/action-button"
import { EditarEvento } from "@/components/admin/editar-evento"
import { cancelarEventoAction } from "@/app/actions/eventos"

export default async function EventoDetalle(props: PageProps<"/eventos/[id]">) {
  const s = await pageSession("administrativo", "tesorero")
  const sb = s.supabase
  const { id } = await props.params
  const [{ data: e }, { data: obligaciones, error }, progreso] = await Promise.all([
    sb.from("eventos_cobro").select("*").eq("id", id).eq("club_id", s.club_id).maybeSingle(),
    sb.from("obligaciones").select("id, miembro_id, monto, pagado, miembros(nombre)").eq("evento_id", id),
    progresoEventos(sb, s.club_id),
  ])
  if (error) throw error
  if (!e) notFound()
  const hoy = hoyISO()
  const p = progreso.get(e.id) ?? { total: 0, pagadas: 0, recaudado: 0, monto_total: 0 }
  const esAdmin = s.roles.includes("administrativo")
  const filas = (obligaciones ?? [])
    .map((o) => ({ ...o, monto: Number(o.monto), pagado: Number(o.pagado), nombre: o.miembros?.nombre ?? "?" }))
    .sort((a, b) => a.pagado / (a.monto || 1) - b.pagado / (b.monto || 1) || a.nombre.localeCompare(b.nombre))

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
            {TIPO_COBRO_LABEL[e.tipo]} · {formatCOP(Number(e.monto))} por jugador · {alcanceLabel(e, p.total)} · vence {formatFecha(e.fecha_limite)} (
            {relativoVencimiento(e.fecha_limite, hoy)})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProgressBar value={p.pagadas} total={p.total} />
          <p className="text-[13px] text-muted-foreground">
            {formatCOP(p.recaudado)} recaudados de {formatCOP(p.monto_total)}
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
              {filas.map((o) => {
                const saldo = Math.max(0, o.monto - o.pagado)
                return (
                  <TableRow key={o.id}>
                    <TableCell>
                      <StatusDot estado={saldo === 0 ? "al_dia" : e.fecha_limite < hoy ? "mora" : "pendiente"} className="mr-2" />
                      <Link href={`/jugadores/${o.miembro_id}`} className="hover:underline">
                        {o.nombre}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCOP(o.monto)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCOP(o.pagado)}</TableCell>
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
