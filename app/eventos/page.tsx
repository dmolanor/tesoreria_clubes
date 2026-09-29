import Link from "next/link"
import { getStore } from "@/lib/data"
import { pageSession } from "@/lib/auth/page"
import { formatCOP, formatFecha } from "@/lib/format"
import { alcanceLabel, progresoEvento } from "@/lib/views"
import { opcionesJugadores } from "@/lib/admin"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ProgressBar } from "@/components/progress-bar"
import { NuevoEvento } from "@/components/admin/nuevo-evento"
import { ActivityPanel } from "@/components/activity-panel"

export default async function EventosPage() {
  const s = await pageSession("administrativo")
  const db = await getStore().read()
  const eventos = db.eventos_cobro
    .filter((e) => e.club_id === s.club_id)
    .sort((a, b) => (a.estado === b.estado ? b.fecha_limite.localeCompare(a.fecha_limite) : a.estado === "activo" ? -1 : 1))

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Eventos de cobro</CardTitle>
          <CardAction>
            <NuevoEvento jugadores={opcionesJugadores(db, s.club_id)} />
          </CardAction>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead>Alcance</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead className="w-48">Progreso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventos.map((e) => {
                const p = progresoEvento(db, e.id)
                return (
                  <TableRow key={e.id} className={e.estado === "cancelado" ? "text-muted-foreground" : undefined}>
                    <TableCell>
                      <Link href={`/eventos/${e.id}`} className="font-medium hover:underline">
                        {e.nombre}
                      </Link>
                      {e.estado === "cancelado" ? <span className="ml-2 text-[13px]">(cancelado)</span> : null}
                    </TableCell>
                    <TableCell>{alcanceLabel(e)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCOP(e.monto)}</TableCell>
                    <TableCell>{formatFecha(e.fecha_limite, true)}</TableCell>
                    <TableCell>{e.estado === "activo" ? <ProgressBar value={p.pagados} total={p.total} /> : "—"}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <ActivityPanel tipos={["evento_cobro_creado", "evento_cobro_cancelado"]} />
    </div>
  )
}
