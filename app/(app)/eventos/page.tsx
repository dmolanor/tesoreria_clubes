import Link from "next/link"
import { pageSession } from "@/lib/auth/page"
import { alcanceLabel, categoriasDelClub, eventosDelClub, opcionesJugadores, progresoEventos } from "@/lib/db/admin"
import { formatCOP, formatFecha } from "@/lib/format"
import { TIPO_COBRO_LABEL } from "@/lib/db/types"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ProgressBar } from "@/components/progress-bar"
import { NuevoEvento } from "@/components/admin/nuevo-evento"
import { ActivityPanel } from "@/components/activity-panel"

export default async function EventosPage() {
  const s = await pageSession("administrativo")
  const sb = s.supabase
  const [eventos, progreso, jugadores, categorias] = await Promise.all([
    eventosDelClub(sb, s.club_id),
    progresoEventos(sb, s.club_id),
    opcionesJugadores(sb, s.club_id),
    categoriasDelClub(sb, s.club_id),
  ])
  const ordenados = [...eventos].sort((a, b) =>
    a.estado === b.estado ? b.fecha_limite.localeCompare(a.fecha_limite) : a.estado === "activo" ? -1 : 1,
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Eventos de cobro</CardTitle>
          <CardAction>
            <NuevoEvento jugadores={jugadores} categorias={categorias} />
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
              {ordenados.map((e) => {
                const p = progreso.get(e.id)
                return (
                  <TableRow key={e.id} className={e.estado === "cancelado" ? "text-muted-foreground" : undefined}>
                    <TableCell>
                      <Link href={`/eventos/${e.id}`} className="font-medium hover:underline">
                        {e.nombre}
                      </Link>
                      <span className="ml-2 text-[13px] text-muted-foreground">
                        {TIPO_COBRO_LABEL[e.tipo]}
                        {e.estado === "cancelado" ? " · cancelado" : ""}
                      </span>
                    </TableCell>
                    <TableCell>{alcanceLabel(e, e.alcance === "individual" ? p?.total : undefined)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCOP(Number(e.monto))}</TableCell>
                    <TableCell>{formatFecha(e.fecha_limite, true)}</TableCell>
                    <TableCell>{e.estado === "activo" && p ? <ProgressBar value={p.pagadas} committed={p.con_acuerdo} total={p.total} /> : "—"}</TableCell>
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
