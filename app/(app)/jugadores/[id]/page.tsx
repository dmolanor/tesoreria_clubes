import Link from "next/link"
import { notFound } from "next/navigation"
import { pageSession } from "@/lib/auth/page"
import { comprobantesDe, estadoCuenta, obligacionesDe, urlsFirmadas } from "@/lib/db/cuenta"
import { formatCOP, formatFecha, hoyISO } from "@/lib/format"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusDot } from "@/components/status-dot"
import { EstadoSelect } from "@/components/admin/estado-select"
import { RolesEditor } from "@/components/admin/roles-editor"
import { CondonarObligacion } from "@/components/condonar-obligacion"
import { RegistrarCruce } from "@/components/tesorero/registrar-cruce"
import { cn } from "@/lib/utils"

export default async function JugadorDetalle(props: PageProps<"/jugadores/[id]">) {
  const s = await pageSession("administrativo", "tesorero")
  const sb = s.supabase
  const { id } = await props.params
  const { data: u } = await sb.from("miembros").select("*").eq("id", id).eq("club_id", s.club_id).maybeSingle()
  if (!u) notFound()
  const hoy = hoyISO()
  const [cuenta, obligaciones, comprobantes] = await Promise.all([
    estadoCuenta(sb, s.club_id, u.id),
    obligacionesDe(sb, u.id),
    comprobantesDe(sb, { miembroId: u.id }),
  ])
  const urls = await urlsFirmadas(sb, comprobantes.map((c) => c.archivo_path))
  const esAdmin = s.roles.includes("administrativo")
  const esTesorero = s.roles.includes("tesorero")
  const pagadas = obligaciones.filter((x) => x.saldo === 0).length

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{u.nombre}</CardTitle>
          <CardDescription>
            {u.correo} · {u.categoria ?? "sin categoría"} · {u.estado}
            {u.auth_user_id ? "" : " · aún no ha entrado a la plataforma"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <StatusDot estado={u.estado === "retirado" ? "inactivo" : cuenta.estado} label />
            <span>
              {pagadas}/{obligaciones.length} cobros pagados
            </span>
            <span>Debe {formatCOP(cuenta.total_pendiente)}</span>
            {cuenta.total_vencido ? <span className="font-medium text-warn">{formatCOP(cuenta.total_vencido)} vencido</span> : null}
            {cuenta.saldo_a_favor ? <span>{formatCOP(cuenta.saldo_a_favor)} a favor</span> : null}
          </div>
          {esTesorero ? <RegistrarCruce miembroId={u.id} nombre={u.nombre} /> : null}
          {esAdmin ? (
            <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-[auto_1fr]">
              <div className="space-y-1.5">
                <p className="label-caps">Estado</p>
                <EstadoSelect key={u.estado} usuarioId={u.id} estado={u.estado} />
              </div>
              <div className="space-y-1.5">
                <p className="label-caps">Roles</p>
                <RolesEditor usuarioId={u.id} activos={u.roles} />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cobros</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cobro</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Pagado</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {obligaciones.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <StatusDot estado={o.saldo === 0 ? "al_dia" : o.evento.fecha_limite < hoy ? "mora" : "pendiente"} className="mr-2" />
                    <Link href={`/eventos/${o.evento.id}`} className="hover:underline">
                      {o.evento.nombre}
                    </Link>
                  </TableCell>
                  <TableCell>{formatFecha(o.evento.fecha_limite, true)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCOP(o.monto)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCOP(o.pagado)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {o.saldo ? formatCOP(o.saldo) : "—"}
                    {o.saldo > 0 && esTesorero ? (
                      <span className="block">
                        <CondonarObligacion obligacionId={o.id} saldo={o.saldo} />
                      </span>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comprobantes</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {comprobantes.map((c) => {
              const href = c.archivo_path ? urls.get(c.archivo_path) : undefined
              return (
                <li key={c.id} className="py-2.5">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-semibold tabular-nums">{formatCOP(c.monto)}</span>
                    <span className="text-[13px] text-muted-foreground">
                      {formatFecha(c.fecha_pago)} ·{" "}
                      <span className={cn(c.estado === "rechazado" && "text-warn", c.estado === "aceptado" && "text-raza")}>
                        {c.esCruce ? "Cruce" : c.estado}
                      </span>
                      {href ? (
                        <>
                          {" · "}
                          <a href={href} target="_blank" className="underline underline-offset-2">
                            archivo
                          </a>
                        </>
                      ) : null}
                      {s.roles.includes("tesorero") ? (
                        <>
                          {" · "}
                          <Link href={`/tesorero/comprobantes/${c.id}`} className="underline underline-offset-2">
                            {c.estado === "pendiente" ? "revisar" : "detalle"}
                          </Link>
                        </>
                      ) : null}
                    </span>
                  </div>
                  {c.estado === "aceptado" ? (
                    <p className="text-[13px] text-muted-foreground">
                      {[...c.desglose.map((d) => `${d.evento}: ${formatCOP(d.monto)} (${d.regla})`), ...(c.saldo_a_favor > 0 ? [`a favor: ${formatCOP(c.saldo_a_favor)}`] : [])].join(" · ")}
                    </p>
                  ) : null}
                  {c.estado === "rechazado" ? <p className="text-[13px]">Motivo: {c.motivo_rechazo}</p> : null}
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
