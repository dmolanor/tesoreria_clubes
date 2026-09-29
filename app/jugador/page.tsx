import { getStore } from "@/lib/data"
import { pageSession } from "@/lib/auth/page"
import { estadoCuenta, saldoAFavorDisponible } from "@/lib/domain/ledger"
import { comprobantesDe, desgloseAplicado, detalleObligaciones, archivoHref } from "@/lib/views"
import { formatCOP, formatFecha, hoyISO, relativoVencimiento } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusDot } from "@/components/status-dot"
import { SubirComprobante } from "@/components/jugador/subir-comprobante"
import { cn } from "@/lib/utils"

export default async function JugadorHome() {
  const s = await pageSession("jugador")
  const db = await getStore().read()
  const hoy = hoyISO()
  const cuenta = estadoCuenta(db, s.usuario.id, hoy)
  const aFavor = saldoAFavorDisponible(db, s.usuario.id)
  const obligaciones = detalleObligaciones(db, s.usuario.id)
  const comprobantes = comprobantesDe(db, s.usuario.id)
  const ultimo = comprobantes[0]

  return (
    <div className="space-y-6">
      {/* Hero: estado de cuenta */}
      <section className="rounded-[12px] border border-border bg-card p-5 sm:p-6">
        {cuenta.totalPendiente > 0 ? (
          <>
            <p className="text-[13px] font-medium text-muted-foreground">Saldo pendiente</p>
            <p className="mt-1 text-[32px] leading-tight font-bold tabular-nums">{formatCOP(cuenta.totalPendiente)}</p>
            <div className="mt-2 space-y-0.5 text-[14px]">
              {cuenta.totalVencido > 0 ? (
                <p className="font-medium text-warn">{formatCOP(cuenta.totalVencido)} ya vencido</p>
              ) : null}
              {cuenta.proximoVencimiento ? (
                <p className="text-muted-foreground">
                  Próximo vencimiento: {formatFecha(cuenta.proximoVencimiento)} ({relativoVencimiento(cuenta.proximoVencimiento, hoy)})
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <StatusDot estado="al_dia" label />
            <p className="mt-1 text-[24px] font-bold">Estás al día</p>
            <p className="text-muted-foreground">No tienes cobros pendientes.</p>
          </>
        )}
        {aFavor > 0 ? (
          <p className="mt-3 text-[14px]">
            Tienes <strong>{formatCOP(aFavor)}</strong> a favor — se aplicará a tu próximo cobro.
          </p>
        ) : null}
        <div className="mt-5">
          <SubirComprobante sugerido={cuenta.totalPendiente || undefined} />
        </div>
        {ultimo && ultimo.estado !== "aceptado" ? (
          <div className={cn("mt-4 rounded-lg border p-3 text-[14px]", ultimo.estado === "rechazado" ? "border-warn" : "border-dashed border-border")}>
            {ultimo.estado === "pendiente" ? (
              <p>
                Tu comprobante de <strong>{formatCOP(ultimo.monto_total)}</strong> del {formatFecha(ultimo.fecha_carga)} está en revisión.
              </p>
            ) : (
              <>
                <p className="font-medium text-warn">
                  Rechazaron tu comprobante de {formatCOP(ultimo.monto_total)} del {formatFecha(ultimo.fecha_carga)}
                </p>
                <p className="mt-0.5">Motivo: {ultimo.motivo_rechazo}</p>
              </>
            )}
          </div>
        ) : null}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Detalle por cobro</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cobro</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {obligaciones.map(({ o, e, saldo }) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <StatusDot estado={saldo === 0 ? "al_dia" : e.fecha_limite < hoy ? "mora" : "pendiente"} className="mr-2" />
                    {e.nombre}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatFecha(e.fecha_limite, true)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCOP(o.monto)}</TableCell>
                  <TableCell className={cn("text-right font-medium tabular-nums", saldo === 0 && "text-muted-foreground")}>
                    {saldo === 0 ? "Pagado" : formatCOP(saldo)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mis comprobantes</CardTitle>
        </CardHeader>
        <CardContent>
          {comprobantes.length === 0 ? (
            <p className="text-muted-foreground">Aún no has subido comprobantes.</p>
          ) : (
            <ul className="divide-y divide-border">
              {comprobantes.map((c) => {
                const href = archivoHref(c)
                return (
                  <li key={c.id} className="py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[15px] font-semibold tabular-nums">{formatCOP(c.monto_total)}</span>
                      <span className="text-[13px] text-muted-foreground">
                        {formatFecha(c.fecha_carga)} ·{" "}
                        <span className={cn(c.estado === "rechazado" && "text-warn", c.estado === "aceptado" && "text-raza")}>{c.estado}</span>
                        {href ? (
                          <>
                            {" · "}
                            <a href={href} target="_blank" className="underline underline-offset-2">
                              ver
                            </a>
                          </>
                        ) : null}
                      </span>
                    </div>
                    {c.estado === "aceptado" ? (
                      <p className="mt-0.5 text-[13px] text-muted-foreground">
                        {desgloseAplicado(db, c.id)
                          .map((d) => `${d.evento}: ${formatCOP(d.monto_aplicado)}`)
                          .join(" · ")}
                      </p>
                    ) : null}
                    {c.estado === "rechazado" ? <p className="mt-0.5 text-[13px]">Motivo: {c.motivo_rechazo}</p> : null}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
