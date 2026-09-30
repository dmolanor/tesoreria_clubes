import Link from "next/link"
import { pageSession } from "@/lib/auth/page"
import { cuadreParaLote, totalAceptadoMes } from "@/lib/db/tesoreria"
import { formatCOP, formatMes, hoyISO } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ConciliacionForm } from "@/components/tesorero/conciliacion-form"
import { AprobarLote } from "@/components/tesorero/aprobar-lote"
import { ActivityPanel } from "@/components/activity-panel"
import { StatusDot } from "@/components/status-dot"
import { cn } from "@/lib/utils"

function mesesHasta(hoy: string, n: number): string[] {
  const [y, m] = hoy.split("-").map(Number)
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 10))
}

export default async function ConciliacionPage(props: PageProps<"/tesorero/conciliacion">) {
  const s = await pageSession("tesorero")
  const sb = s.supabase
  const meses = mesesHasta(hoyISO(), 4)
  const { mes: raw } = await props.searchParams
  const mes = typeof raw === "string" && meses.includes(raw) ? raw : meses[0]

  const [{ data: historial, error }, resumen, cuadre] = await Promise.all([
    sb.from("conciliaciones").select("*").eq("club_id", s.club_id).order("mes", { ascending: false }),
    totalAceptadoMes(sb, s.club_id, mes),
    cuadreParaLote(sb, s.club_id, mes),
  ])
  if (error) throw error
  const actual = historial?.find((c) => c.mes === mes)
  const anterior = historial?.find((c) => c.mes < mes)

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
            {formatMes(mes)} (por fecha de pago): {resumen.aceptados} comprobantes aceptados por {formatCOP(resumen.total)} · {resumen.pendientes} sin
            revisar · {resumen.rechazados} rechazados.
            {resumen.pendientes && !cuadre?.cuadra ? " Revisa los pendientes antes de cerrar el mes." : ""}
          </p>
          {cuadre?.cuadra ? (
            <p className="text-[13px]">
              La diferencia de {formatCOP(cuadre.diferencia)} entre el banco y lo aceptado es exactamente lo que suman {cuadre.pendientes === 1 ? "el comprobante pendiente" : `los ${cuadre.pendientes} comprobantes pendientes`} de{" "}
              {formatMes(mes)}. Al aprobarlos, el mes queda en $0 de diferencia. Cada uno se aplica con la propuesta de las reglas de conciliación, y los que no tengan
              propuesta completa quedan en Comprobantes para revisarlos a mano.
            </p>
          ) : null}
          <AprobarLote key={mes} mes={mes} pendientes={cuadre?.cuadra ? cuadre.pendientes : 0} />
          <ConciliacionForm
            mes={mes}
            totalAceptado={resumen.total}
            saldoInicial={Number(actual?.saldo_inicial ?? anterior?.saldo_final ?? 0)}
            saldoFinal={actual ? Number(actual.saldo_final) : null}
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
              {(historial ?? []).map((c) => {
                const dif = Number(c.diferencia ?? 0)
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/tesorero/conciliacion?mes=${c.mes}`} className="hover:underline">
                        {formatMes(c.mes)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCOP(Number(c.saldo_inicial))}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCOP(Number(c.saldo_final))}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCOP(Number(c.total_aceptado))}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", dif !== 0 && "font-bold text-warn")}>
                      <StatusDot estado={dif === 0 ? "al_dia" : "mora"} className="mr-1.5" />
                      {formatCOP(dif)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <ActivityPanel tipos={["conciliacion_guardada", "comprobante_aceptado", "comprobante_rechazado"]} />
    </div>
  )
}
