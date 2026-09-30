import Link from "next/link"
import { pageSession } from "@/lib/auth/page"
import { bandeja, enMora, reglasDelClub, totalAceptadoMes } from "@/lib/db/tesoreria"
import { eventosDelClub, progresoEventos } from "@/lib/db/admin"
import { formatCOP, formatFecha, formatMes, hoyISO } from "@/lib/format"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PendientesList } from "@/components/tesorero/pendientes-list"
import { ProgressBar } from "@/components/progress-bar"
import { ActivityPanel } from "@/components/activity-panel"
import { StatusDot } from "@/components/status-dot"

export default async function TesoreroHome() {
  const s = await pageSession("tesorero")
  const sb = s.supabase
  const hoy = hoyISO()
  const mesActual = `${hoy.slice(0, 7)}-01`
  const [items, reglas, mora, eventos, progreso, resumen, { data: conciliacion }] = await Promise.all([
    bandeja(sb, s.club_id),
    reglasDelClub(sb, s.club_id),
    enMora(sb, s.club_id, hoy),
    eventosDelClub(sb, s.club_id),
    progresoEventos(sb, s.club_id),
    totalAceptadoMes(sb, s.club_id, mesActual),
    sb.from("conciliaciones").select("diferencia").eq("club_id", s.club_id).eq("mes", mesActual).maybeSingle(),
  ])
  const requieren = items.filter((c) => c.revision.requiere)
  const enCurso = eventos
    .filter((e) => e.estado === "activo" && e.fecha_limite >= mesActual)
    .sort((a, b) => a.fecha_limite.localeCompare(b.fecha_limite))
  const nombresReglas = new Map(reglas.map((r) => [r.id, r.nombre]))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent>
            <p className="text-[13px] font-medium text-muted-foreground">Recaudado en {formatMes(mesActual).toLowerCase()}</p>
            <p className="mt-1 text-[24px] leading-tight font-bold tabular-nums">{formatCOP(resumen.total)}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground tabular-nums">{resumen.aceptados} comprobantes aceptados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-[13px] font-medium text-muted-foreground">Por revisar</p>
            <p className="mt-1 text-[24px] leading-tight font-bold tabular-nums">{items.length}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {requieren.length ? <span className="font-medium text-warn">{requieren.length} requieren revisión</span> : "ninguno urgente"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-[13px] font-medium text-muted-foreground">En mora</p>
            <p className="mt-1 text-[24px] leading-tight font-bold tabular-nums">{mora.length}</p>
            <Link href="/tesorero/mora" className="mt-0.5 inline-block text-[13px] underline underline-offset-2">
              Ver lista
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-[13px] font-medium text-muted-foreground">Conciliación de {formatMes(mesActual).toLowerCase()}</p>
            {!conciliacion ? (
              <p className="mt-1 flex items-center gap-2 text-[15px] font-semibold">
                <StatusDot estado="pendiente" /> Pendiente de cerrar
              </p>
            ) : Number(conciliacion.diferencia) === 0 ? (
              <p className="mt-1 flex items-center gap-2 text-[15px] font-semibold">
                <StatusDot estado="al_dia" /> Cuadrada
              </p>
            ) : (
              <p className="mt-1 flex items-center gap-2 text-[15px] font-semibold text-warn">
                <StatusDot estado="mora" /> Difiere {formatCOP(Number(conciliacion.diferencia))}
              </p>
            )}
            <Link href="/tesorero/conciliacion" className="mt-0.5 inline-block text-[13px] underline underline-offset-2">
              Ir a conciliación
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Cobros en curso</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {enCurso.length === 0 ? <p className="text-muted-foreground">Sin cobros en curso.</p> : null}
              {enCurso.map((e) => {
                const p = progreso.get(e.id)
                return (
                  <Link key={e.id} href={`/eventos/${e.id}`} className="block rounded-md hover:bg-muted/60">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-[15px] font-semibold">{e.nombre}</p>
                      <p className="text-[13px] text-muted-foreground">vence {formatFecha(e.fecha_limite, true)}</p>
                    </div>
                    <ProgressBar value={p?.pagadas ?? 0} committed={p?.con_acuerdo ?? 0} total={p?.total ?? 0} className="mt-1" />
                  </Link>
                )
              })}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Requieren tu revisión ({requieren.length})</CardTitle>
              {items.length > 0 ? (
                <CardAction>
                  <Link href="/tesorero/comprobantes" className="text-[13px] underline underline-offset-2">
                    Ver los {items.length} pendientes
                  </Link>
                </CardAction>
              ) : null}
            </CardHeader>
            <CardContent>
              {requieren.length === 0 ? (
                <p className="text-muted-foreground">
                  {items.length ? "Los pendientes traen propuesta clara." : "Sin comprobantes por revisar."}
                </p>
              ) : (
                <PendientesList items={requieren} reglas={nombresReglas} limit={8} hideMore />
              )}
            </CardContent>
          </Card>
          <ActivityPanel />
        </div>

        <div className="space-y-6">
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
                {mora
                  .slice(-6)
                  .reverse()
                  .map((m) => (
                    <li key={m.id}>
                      <Link href={`/jugadores/${m.id}`} className="hover:underline">
                        {m.nombre}
                      </Link>
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
