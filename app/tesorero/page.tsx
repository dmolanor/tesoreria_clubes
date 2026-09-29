import Link from "next/link"
import { getStore } from "@/lib/data"
import { pageSession } from "@/lib/auth/page"
import { formatCOP, formatMes, hoyISO } from "@/lib/format"
import { jugadoresEnMora } from "@/lib/mora"
import { progresoEvento } from "@/lib/views"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PendientesList } from "@/components/tesorero/pendientes-list"
import { ProgressBar } from "@/components/progress-bar"
import { ActivityPanel } from "@/components/activity-panel"
import { StatusDot } from "@/components/status-dot"

export default async function TesoreroHome() {
  const s = await pageSession("tesorero")
  const db = await getStore().read()
  const hoy = hoyISO()
  const mesActual = `${hoy.slice(0, 7)}-01`
  const conciliacion = db.conciliaciones.find((c) => c.club_id === s.club_id && c.mes === mesActual)
  const mora = jugadoresEnMora(db, s.club_id, hoy)
  const eventos = db.eventos_cobro
    .filter((e) => e.club_id === s.club_id && e.estado === "activo" && e.fecha_limite >= hoy.slice(0, 8) + "01")
    .sort((a, b) => a.fecha_limite.localeCompare(b.fecha_limite))

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Comprobantes por revisar</CardTitle>
          </CardHeader>
          <CardContent>
            <PendientesList db={db} clubId={s.club_id} limit={8} />
          </CardContent>
        </Card>
        <ActivityPanel />
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Conciliación de {formatMes(mesActual).toLowerCase()}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!conciliacion ? (
              <p className="flex items-center gap-2">
                <StatusDot estado="pendiente" /> Pendiente de cerrar
              </p>
            ) : conciliacion.diferencia === 0 ? (
              <p className="flex items-center gap-2">
                <StatusDot estado="al_dia" /> Cuadrada — $0 de diferencia
              </p>
            ) : (
              <p className="flex items-center gap-2 text-warn">
                <StatusDot estado="mora" /> Diferencia de {formatCOP(conciliacion.diferencia)}
              </p>
            )}
            <Link href="/tesorero/conciliacion" className="text-[13px] underline underline-offset-2">
              Ir a conciliación
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>En mora ({mora.length})</CardTitle>
            <CardAction>
              <Link href="/tesorero/mora" className="text-[13px] underline underline-offset-2">
                Ver todos
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {mora.slice(-6).reverse().map(({ u }) => (
                <li key={u.id}>
                  <Link href={`/jugadores/${u.id}`} className="hover:underline">
                    {u.nombre}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cobros en curso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {eventos.map((e) => {
              const p = progresoEvento(db, e.id)
              return (
                <Link key={e.id} href={`/eventos/${e.id}`} className="block rounded-md hover:bg-muted/60">
                  <p className="text-[13px] font-semibold">{e.nombre}</p>
                  <ProgressBar value={p.pagados} total={p.total} />
                </Link>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
