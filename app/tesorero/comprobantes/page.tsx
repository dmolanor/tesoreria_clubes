import Link from "next/link"
import { getStore } from "@/lib/data"
import { pageSession } from "@/lib/auth/page"
import { nombreUsuario } from "@/lib/domain/ledger"
import { formatCOP, formatFecha } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PendientesList } from "@/components/tesorero/pendientes-list"
import { cn } from "@/lib/utils"

const FILTROS = [
  { v: "pendiente", label: "Por revisar" },
  { v: "aceptado", label: "Aceptados" },
  { v: "rechazado", label: "Rechazados" },
] as const

export default async function ComprobantesPage(props: PageProps<"/tesorero/comprobantes">) {
  const s = await pageSession("tesorero")
  const { estado: raw } = await props.searchParams
  const estado = FILTROS.some((f) => f.v === raw) ? (raw as string) : "pendiente"
  const db = await getStore().read()
  const club = new Set(db.usuarios.filter((u) => u.club_id === s.club_id).map((u) => u.id))
  const lista = db.comprobantes
    .filter((c) => c.estado === estado && club.has(c.usuario_id))
    .sort((a, b) => b.fecha_carga.localeCompare(a.fecha_carga))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comprobantes</CardTitle>
        <div className="flex gap-1 pt-2">
          {FILTROS.map((f) => (
            <Link
              key={f.v}
              href={`/tesorero/comprobantes?estado=${f.v}`}
              className={cn("rounded-md px-3 py-1.5 text-[13px] font-medium", estado === f.v ? "bg-ink text-paper" : "bg-muted text-muted-foreground hover:text-foreground")}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {estado === "pendiente" ? (
          <PendientesList db={db} clubId={s.club_id} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jugador</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Subido</TableHead>
                <TableHead>Revisado por</TableHead>
                {estado === "rechazado" ? <TableHead>Motivo</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.slice(0, 200).map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/tesorero/comprobantes/${c.id}`} className="hover:underline">
                      {nombreUsuario(db, c.usuario_id)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCOP(c.monto_total)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatFecha(c.fecha_carga)}</TableCell>
                  <TableCell className="text-muted-foreground">{nombreUsuario(db, c.revisado_por)}</TableCell>
                  {estado === "rechazado" ? <TableCell className="whitespace-normal">{c.motivo_rechazo}</TableCell> : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
