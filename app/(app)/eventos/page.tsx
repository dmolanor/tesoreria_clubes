import Link from "next/link"
import { pageSession } from "@/lib/auth/page"
import { alcanceLabel, categoriasDelClub, eventosDelClub, opcionesJugadores, progresoEventos, type Progreso } from "@/lib/db/admin"
import { formatCOP, formatFecha } from "@/lib/format"
import { TIPO_COBRO_LABEL, type EventoCobro } from "@/lib/db/types"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table"
import { ProgressBar } from "@/components/progress-bar"
import { NuevoEvento } from "@/components/admin/nuevo-evento"
import { ActivityPanel } from "@/components/activity-panel"
import { SortableHead } from "@/components/sortable-head"
import { parseSort, sortRows, type SortColumns } from "@/lib/sort"

interface Fila {
  e: EventoCobro
  p: Progreso | undefined
  alcance: string
}

const COLUMNAS: SortColumns<Fila> = {
  evento: { kind: "text", value: (f) => f.e.nombre },
  alcance: { kind: "text", value: (f) => f.alcance },
  monto: { kind: "number", value: (f) => Number(f.e.monto) },
  vence: { kind: "date", value: (f) => f.e.fecha_limite },
  // Solo los eventos activos muestran progreso; los demás van al final.
  progreso: { kind: "number", value: (f) => (f.e.estado === "activo" && f.p?.total ? f.p.pagadas / f.p.total : null) },
}

export default async function EventosPage(props: PageProps<"/eventos">) {
  const s = await pageSession("administrativo")
  const orden = parseSort(await props.searchParams, COLUMNAS)
  const sb = s.supabase
  const [eventos, progreso, jugadores, categorias] = await Promise.all([
    eventosDelClub(sb, s.club_id),
    progresoEventos(sb, s.club_id),
    opcionesJugadores(sb, s.club_id),
    categoriasDelClub(sb, s.club_id),
  ])
  // Sin orden elegido: activos primero, del vencimiento más reciente al más antiguo.
  const porDefecto = [...eventos].sort((a, b) =>
    a.estado === b.estado ? b.fecha_limite.localeCompare(a.fecha_limite) : a.estado === "activo" ? -1 : 1,
  )
  const filas = sortRows(
    porDefecto.map((e) => {
      const p = progreso.get(e.id)
      return { e, p, alcance: alcanceLabel(e, e.alcance === "individual" ? p?.total : undefined) }
    }),
    COLUMNAS,
    orden,
  )
  const head = (col: keyof typeof COLUMNAS & string, label: string, align?: "right", className?: string) => (
    <SortableHead col={col} label={label} column={COLUMNAS[col]} sort={orden} pathname="/eventos" align={align} className={className} />
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
                {head("evento", "Evento")}
                {head("alcance", "Alcance")}
                {head("monto", "Monto", "right")}
                {head("vence", "Vence")}
                {head("progreso", "Progreso", undefined, "w-48")}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map(({ e, p, alcance }) => {
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
                    <TableCell>{alcance}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCOP(Number(e.monto))}</TableCell>
                    <TableCell>{formatFecha(e.fecha_limite, true)}</TableCell>
                    <TableCell>{e.estado === "activo" && p ? <ProgressBar value={p.pagadas} total={p.total} /> : "—"}</TableCell>
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
