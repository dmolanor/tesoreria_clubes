import Link from "next/link"
import { pageSession } from "@/lib/auth/page"
import { bandeja, enMora, reglasDelClub } from "@/lib/db/tesoreria"
import { eventosDelClub, progresoEventos } from "@/lib/db/admin"
import { formatCOP, formatMes, hoyISO } from "@/lib/format"
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
  const [items, reglas, mora, eventos, progreso, { data: conciliacion }] = await Promise.all([
    bandeja(sb, s.club_id),
    reglasDelClub(sb, s.club_id),
    enMora(sb, s.club_id, hoy),
    eventosDelClub(sb, s.club_id),
    progresoEventos(sb, s.club_id),
    sb.from("conciliaciones").select("diferencia").eq("club_id", s.club_id).eq("mes", mesActual).maybeSingle(),
  ])
  const enCurso = eventos
    .filter((e) => e.estado === "activo" && e.fecha_limite >= mesActual)
    .sort((a, b) => a.fecha_limite.localeCompare(b.fecha_limite))

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Comprobantes por revisar</CardTitle>
          </CardHeader>
          <CardContent>
            <PendientesList items={items} reglas={new Map(reglas.map((r) => [r.id, r.nombre]))} limit={8} />
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
            ) : Number(conciliacion.diferencia) === 0 ? (
              <p className="flex items-center gap-2">
                <StatusDot estado="al_dia" /> Cuadrada — $0 de diferencia
              </p>
            ) : (
              <p className="flex items-center gap-2 text-warn">
                <StatusDot estado="mora" /> Diferencia de {formatCOP(Number(conciliacion.diferencia))}
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

        <Card>
          <CardHeader>
            <CardTitle>Cobros en curso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {enCurso.map((e) => {
              const p = progreso.get(e.id)
              return (
                <Link key={e.id} href={`/eventos/${e.id}`} className="block rounded-md hover:bg-muted/60">
                  <p className="text-[13px] font-semibold">{e.nombre}</p>
                  <ProgressBar value={p?.pagadas ?? 0} total={p?.total ?? 0} />
                </Link>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
