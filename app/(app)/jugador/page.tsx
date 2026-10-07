import { pageSession } from "@/lib/auth/page"
import { comprobantesDe, estadoCuenta, obligacionesDe, urlsFirmadas } from "@/lib/db/cuenta"
import { acuerdosDeMiembro } from "@/lib/db/acuerdos"
import { tareasDeMiembro } from "@/lib/db/tareas"
import { cobrosDelAño } from "@/lib/db/calendario"
import { formatCOP, formatFecha, hoyISO, relativoVencimiento } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusDot } from "@/components/status-dot"
import { SubirComprobante } from "@/components/jugador/subir-comprobante"
import { AcuerdosPago } from "@/components/jugador/acuerdos-pago"
import { TareasJugador } from "@/components/jugador/tareas-jugador"
import { CalendarioPagos } from "@/components/jugador/calendario-pagos"
import { cn } from "@/lib/utils"

export default async function JugadorHome() {
  const s = await pageSession("jugador")
  const sb = s.supabase
  const hoy = hoyISO()
  const año = Number(hoy.slice(0, 4))
  const [cuenta, obligaciones, comprobantes, acuerdos, tareas, calendario] = await Promise.all([
    estadoCuenta(sb, s.club_id, s.usuario.id),
    obligacionesDe(sb, s.usuario.id),
    comprobantesDe(sb, { miembroId: s.usuario.id }),
    acuerdosDeMiembro(sb, s.usuario.id),
    tareasDeMiembro(sb, s.usuario.id),
    cobrosDelAño(sb, s.club_id, s.usuario.id, año),
  ])
  const urls = await urlsFirmadas(sb, comprobantes.map((c) => c.archivo_path))
  const ultimo = comprobantes[0]

  return (
    <div className="space-y-6">
      {/* Hero: estado de cuenta */}
      <section className="rounded-[12px] border border-border bg-card p-5 sm:p-6">
        {cuenta.total_pendiente > 0 ? (
          <>
            <p className="text-[13px] font-medium text-muted-foreground">Saldo pendiente</p>
            <p className="mt-1 text-[32px] leading-tight font-bold tabular-nums">{formatCOP(cuenta.total_pendiente)}</p>
            <div className="mt-2 space-y-0.5 text-[14px]">
              {cuenta.total_vencido > 0 ? <p className="font-medium text-warn">{formatCOP(cuenta.total_vencido)} ya vencido</p> : null}
              {cuenta.proximo_vencimiento ? (
                <p className="text-muted-foreground">
                  Próximo vencimiento: {formatFecha(cuenta.proximo_vencimiento)} ({relativoVencimiento(cuenta.proximo_vencimiento, hoy)})
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
        {cuenta.saldo_a_favor > 0 ? (
          <p className="mt-3 text-[14px]">
            Tienes <strong>{formatCOP(cuenta.saldo_a_favor)}</strong> a favor. Se aplicará a tu próximo cobro.
          </p>
        ) : null}
        <div className="mt-5">
          <SubirComprobante sugerido={cuenta.total_pendiente || undefined} hoy={hoy} />
        </div>
        {ultimo && ultimo.estado !== "aceptado" ? (
          <div className={cn("mt-4 rounded-lg border p-3 text-[14px]", ultimo.estado === "rechazado" ? "border-warn" : "border-dashed border-border")}>
            {ultimo.estado === "pendiente" ? (
              <p>
                Tu comprobante de <strong>{formatCOP(ultimo.monto)}</strong> del {formatFecha(ultimo.created_at)} está en revisión.
              </p>
            ) : (
              <>
                <p className="font-medium text-warn">
                  Rechazaron tu comprobante de {formatCOP(ultimo.monto)} del {formatFecha(ultimo.created_at)}
                </p>
                <p className="mt-0.5">Motivo: {ultimo.motivo_rechazo}</p>
              </>
            )}
          </div>
        ) : null}
      </section>

      <AcuerdosPago acuerdos={acuerdos} />

      <TareasJugador tareas={tareas} />

      <CalendarioPagos año={año} meses={calendario.meses} hoy={hoy} />

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
              {obligaciones.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <StatusDot estado={o.saldo === 0 ? "al_dia" : o.evento.fecha_limite < hoy ? "mora" : "pendiente"} className="mr-2" />
                    {o.evento.nombre}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatFecha(o.evento.fecha_limite, true)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCOP(o.monto)}</TableCell>
                  <TableCell className={cn("text-right font-medium tabular-nums", o.saldo === 0 && "text-muted-foreground")}>
                    {o.saldo === 0 ? "Pagado" : formatCOP(o.saldo)}
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
                const href = c.archivo_path ? urls.get(c.archivo_path) : undefined
                return (
                  <li key={c.id} className="py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[15px] font-semibold tabular-nums">{formatCOP(c.monto)}</span>
                      <span className="text-[13px] text-muted-foreground">
                        {formatFecha(c.fecha_pago)} ·{" "}
                        <span className={cn(c.estado === "rechazado" && "text-warn", c.estado === "aceptado" && "text-raza")}>
                          {c.esCruce ? "Cruce" : c.estado === "pendiente" ? "En revisión" : c.estado === "aceptado" ? "Aceptado" : "Rechazado"}
                        </span>
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
                        {[...c.desglose.map((d) => `${d.evento}: ${formatCOP(d.monto)}`), ...(c.saldo_a_favor > 0 ? [`a favor: ${formatCOP(c.saldo_a_favor)}`] : [])].join(" · ")}
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
