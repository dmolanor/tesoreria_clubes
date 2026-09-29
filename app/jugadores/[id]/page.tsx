import Link from "next/link"
import { notFound } from "next/navigation"
import { getStore } from "@/lib/data"
import { pageSession } from "@/lib/auth/page"
import { estadoCuenta, saldoAFavorDisponible } from "@/lib/domain/ledger"
import { archivoHref, comprobantesDe, desgloseAplicado, detalleObligaciones } from "@/lib/views"
import { formatCOP, formatFecha, hoyISO } from "@/lib/format"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusDot } from "@/components/status-dot"
import { EstadoSelect } from "@/components/admin/estado-select"
import { RolesEditor } from "@/components/admin/roles-editor"
import type { Rol } from "@/lib/data/types"
import { cn } from "@/lib/utils"

export default async function JugadorDetalle(props: PageProps<"/jugadores/[id]">) {
  const s = await pageSession("administrativo", "tesorero")
  const { id } = await props.params
  const db = await getStore().read()
  const u = db.usuarios.find((u) => u.id === id && u.club_id === s.club_id)
  if (!u) notFound()
  const hoy = hoyISO()
  const cuenta = estadoCuenta(db, u.id, hoy)
  const aFavor = saldoAFavorDisponible(db, u.id)
  const obligaciones = detalleObligaciones(db, u.id)
  const comprobantes = comprobantesDe(db, u.id)
  const esAdmin = s.roles.includes("administrativo")
  const roles = db.roles_usuario.filter((r) => r.usuario_id === u.id && r.activo).map((r) => r.rol as Rol)
  const pagadas = obligaciones.filter((x) => x.saldo === 0).length

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{u.nombre}</CardTitle>
          <CardDescription>
            {u.correo} · {u.categoria ?? "sin categoría"} · {u.estado}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <StatusDot estado={u.estado === "retirado" ? "inactivo" : cuenta.estado} label />
            <span>
              {pagadas}/{obligaciones.length} cobros pagados
            </span>
            <span>Debe {formatCOP(cuenta.totalPendiente)}</span>
            {cuenta.totalVencido ? <span className="font-medium text-warn">{formatCOP(cuenta.totalVencido)} vencido</span> : null}
            {aFavor ? <span>{formatCOP(aFavor)} a favor</span> : null}
          </div>
          {esAdmin ? (
            <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-[auto_1fr]">
              <div className="space-y-1.5">
                <p className="label-caps">Estado</p>
                <EstadoSelect key={u.estado} usuarioId={u.id} estado={u.estado} />
              </div>
              <div className="space-y-1.5">
                <p className="label-caps">Roles</p>
                <RolesEditor usuarioId={u.id} activos={roles} />
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
              {obligaciones.map(({ o, e, pagado, saldo }) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <StatusDot estado={saldo === 0 ? "al_dia" : e.fecha_limite < hoy ? "mora" : "pendiente"} className="mr-2" />
                    <Link href={`/eventos/${e.id}`} className="hover:underline">
                      {e.nombre}
                    </Link>
                  </TableCell>
                  <TableCell>{formatFecha(e.fecha_limite, true)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCOP(o.monto)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCOP(pagado)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{saldo ? formatCOP(saldo) : "—"}</TableCell>
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
            {comprobantes.map((c) => (
              <li key={c.id} className="py-2.5">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold tabular-nums">{formatCOP(c.monto_total)}</span>
                  <span className="text-[13px] text-muted-foreground">
                    {formatFecha(c.fecha_carga)} ·{" "}
                    <span className={cn(c.estado === "rechazado" && "text-warn", c.estado === "aceptado" && "text-raza")}>{c.estado}</span>
                    {archivoHref(c) ? (
                      <>
                        {" · "}
                        <a href={archivoHref(c)!} target="_blank" className="underline underline-offset-2">
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
                    {desgloseAplicado(db, c.id)
                      .map((d) => `${d.evento}: ${formatCOP(d.monto_aplicado)} (${d.regla})`)
                      .join(" · ")}
                  </p>
                ) : null}
                {c.estado === "rechazado" ? <p className="text-[13px]">Motivo: {c.motivo_rechazo}</p> : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
