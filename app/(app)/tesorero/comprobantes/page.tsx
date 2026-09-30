import Link from "next/link"
import { pageSession } from "@/lib/auth/page"
import { bandeja, reglasDelClub } from "@/lib/db/tesoreria"
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
type Filtro = (typeof FILTROS)[number]["v"]

export default async function ComprobantesPage(props: PageProps<"/tesorero/comprobantes">) {
  const s = await pageSession("tesorero")
  const sb = s.supabase
  const { estado: raw } = await props.searchParams
  const estado: Filtro = FILTROS.some((f) => f.v === raw) ? (raw as Filtro) : "pendiente"

  let contenido: React.ReactNode
  if (estado === "pendiente") {
    const [items, reglas] = await Promise.all([bandeja(sb, s.club_id), reglasDelClub(sb, s.club_id)])
    contenido = <PendientesList items={items} reglas={new Map(reglas.map((r) => [r.id, r.nombre]))} />
  } else {
    const { data, error } = await sb
      .from("comprobantes")
      .select(
        "id, monto, fecha_pago, motivo_rechazo, jugador:miembros!comprobantes_club_id_miembro_id_fkey(nombre), revisor:miembros!comprobantes_club_id_revisado_por_fkey(nombre)",
      )
      .eq("club_id", s.club_id)
      .eq("estado", estado)
      .order("created_at", { ascending: false })
      .limit(200)
    if (error) throw error
    contenido = (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Jugador</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead>Fecha de pago</TableHead>
            <TableHead>Revisado por</TableHead>
            {estado === "rechazado" ? <TableHead>Motivo</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data ?? []).map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <Link href={`/tesorero/comprobantes/${c.id}`} className="hover:underline">
                  {c.jugador?.nombre}
                </Link>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatCOP(Number(c.monto))}</TableCell>
              <TableCell className="text-muted-foreground">{formatFecha(c.fecha_pago)}</TableCell>
              <TableCell className="text-muted-foreground">{c.revisor?.nombre ?? "—"}</TableCell>
              {estado === "rechazado" ? <TableCell className="whitespace-normal">{c.motivo_rechazo}</TableCell> : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

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
      <CardContent className="overflow-x-auto">{contenido}</CardContent>
    </Card>
  )
}
