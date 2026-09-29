import Link from "next/link"
import { getStore } from "@/lib/data"
import { pageSession } from "@/lib/auth/page"
import { totalAceptadoMes } from "@/lib/domain/ledger"
import { diaLocal, formatCOP, formatMes, hoyISO } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ConciliacionForm } from "@/components/tesorero/conciliacion-form"
import { ActivityPanel } from "@/components/activity-panel"
import { StatusDot } from "@/components/status-dot"
import { cn } from "@/lib/utils"

function mesesHasta(hoy: string, n: number): string[] {
  const [y, m] = hoy.split("-").map(Number)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1))
    return d.toISOString().slice(0, 10)
  })
}

export default async function ConciliacionPage(props: PageProps<"/tesorero/conciliacion">) {
  const s = await pageSession("tesorero")
  const db = await getStore().read()
  const hoy = hoyISO()
  const meses = mesesHasta(hoy, 4)
  const { mes: raw } = await props.searchParams
  const mes = typeof raw === "string" && meses.includes(raw) ? raw : meses[0]

  const historial = db.conciliaciones.filter((c) => c.club_id === s.club_id).sort((a, b) => b.mes.localeCompare(a.mes))
  const actual = historial.find((c) => c.mes === mes)
  const anterior = historial.find((c) => c.mes < mes)
  const total = totalAceptadoMes(db, s.club_id, mes)
  const club = new Set(db.usuarios.filter((u) => u.club_id === s.club_id).map((u) => u.id))
  const delMes = db.comprobantes.filter((c) => club.has(c.usuario_id) && diaLocal(c.fecha_carga).startsWith(mes.slice(0, 7)))

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Conciliación mensual</CardTitle>
          <div className="flex flex-wrap gap-1 pt-2">
            {meses.map((m) => (
              <Link
                key={m}
                href={`/tesorero/conciliacion?mes=${m}`}
                className={cn("rounded-md px-3 py-1.5 text-[13px] font-medium", m === mes ? "bg-ink text-paper" : "bg-muted text-muted-foreground hover:text-foreground")}
              >
                {formatMes(m)}
              </Link>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-[13px] text-muted-foreground">
            {formatMes(mes)}: {delMes.filter((c) => c.estado === "aceptado").length} comprobantes aceptados por {formatCOP(total)} ·{" "}
            {delMes.filter((c) => c.estado === "pendiente").length} sin revisar · {delMes.filter((c) => c.estado === "rechazado").length} rechazados.
            {delMes.some((c) => c.estado === "pendiente") ? " Revisa los pendientes antes de cerrar el mes." : ""}
          </p>
          <ConciliacionForm
            mes={mes}
            totalAceptado={total}
            saldoInicial={actual?.saldo_inicial ?? anterior?.saldo_final ?? 0}
            saldoFinal={actual?.saldo_final ?? null}
            notas={actual?.notas ?? null}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mes</TableHead>
                <TableHead className="text-right">Saldo inicial</TableHead>
                <TableHead className="text-right">Saldo final</TableHead>
                <TableHead className="text-right">Aceptado</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historial.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/tesorero/conciliacion?mes=${c.mes}`} className="hover:underline">
                      {formatMes(c.mes)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCOP(c.saldo_inicial)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCOP(c.saldo_final)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCOP(c.total_aceptado)}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", c.diferencia !== 0 && "font-bold text-warn")}>
                    <StatusDot estado={c.diferencia === 0 ? "al_dia" : "mora"} className="mr-1.5" />
                    {formatCOP(c.diferencia)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <ActivityPanel tipos={["conciliacion_guardada", "comprobante_aceptado", "comprobante_rechazado"]} />
    </div>
  )
}
