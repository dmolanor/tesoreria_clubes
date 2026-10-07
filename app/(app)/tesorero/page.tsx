import Link from "next/link"
import { bandeja, enMora, reglasDelClub } from "@/lib/db/tesoreria"
import { eventosDelClub, progresoEventos } from "@/lib/db/admin"
import { kpisClub } from "@/lib/db/kpis"
import { egresosMes } from "@/lib/db/egresos"
import { pageSession } from "@/lib/auth/page"
import { formatCOP, formatFecha, formatMes, hoyISO } from "@/lib/format"
import { CATEGORIA_EGRESO_LABEL, type CategoriaEgreso } from "@/lib/db/types"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PendientesList } from "@/components/tesorero/pendientes-list"
import { ProgressBar } from "@/components/progress-bar"
import { ActivityPanel } from "@/components/activity-panel"
import { TareasPendientes } from "@/components/tareas/tareas-pendientes"
import { CategoriaTag } from "@/components/categoria-tag"

export default async function TesoreroHome() {
  const s = await pageSession("tesorero")
  const sb = s.supabase
  const hoy = hoyISO()
  const mesActual = `${hoy.slice(0, 7)}-01`
  const [items, reglas, mora, eventos, progreso, kpis, egresos] = await Promise.all([
    bandeja(sb, s.club_id),
    reglasDelClub(sb, s.club_id),
    enMora(sb, s.club_id, hoy),
    eventosDelClub(sb, s.club_id),
    progresoEventos(sb, s.club_id),
    kpisClub(sb, s.club_id, mesActual),
    egresosMes(sb, s.club_id, mesActual),
  ])
  const requieren = items.filter((c) => c.revision.requiere)
  const enCurso = eventos
    .filter((e) => e.estado === "activo" && e.fecha_limite >= mesActual)
    .sort((a, b) => a.fecha_limite.localeCompare(b.fecha_limite))
  const nombresReglas = new Map(reglas.map((r) => [r.id, r.nombre]))

  const porCategoria = new Map<CategoriaEgreso, number>()
  for (const e of egresos.items) {
    if (e.anulado_en) continue
    porCategoria.set(e.categoria, (porCategoria.get(e.categoria) ?? 0) + e.monto)
  }
  const topCategorias = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)

  return (
    <div className="space-y-6">
      {/* a. KPIs — cada uno como número destacado (DESIGN.md: números concretos, no adjetivos). */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card>
          <CardContent>
            <p className="text-[13px] font-medium text-muted-foreground">Recaudo de {formatMes(mesActual).toLowerCase()}</p>
            <p className="mt-1 text-[24px] leading-tight font-bold tabular-nums">{formatCOP(kpis.recaudo.recaudado)}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground tabular-nums">
              de {formatCOP(kpis.recaudo.totalEsperado)} · {kpis.recaudo.pct}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-[13px] font-medium text-muted-foreground">Jugadores en mora</p>
            <p className="mt-1 text-[24px] leading-tight font-bold tabular-nums">{kpis.jugadoresEnMora}</p>
            <Link href="/tesorero/mora" className="mt-0.5 inline-block text-[13px] underline underline-offset-2">
              Ver lista
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-[13px] font-medium text-muted-foreground">Monto en mora</p>
            <p className="mt-1 text-[24px] leading-tight font-bold tabular-nums text-warn">{formatCOP(kpis.montoEnMora)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-[13px] font-medium text-muted-foreground">Comprobantes pendientes</p>
            <p className="mt-1 text-[24px] leading-tight font-bold tabular-nums">{kpis.comprobantesPendientes}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {requieren.length ? <span className="font-medium text-warn">{requieren.length} requieren revisión</span> : "ninguno urgente"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-[13px] font-medium text-muted-foreground">Saldo a favor del club</p>
            <p className="mt-1 text-[24px] leading-tight font-bold tabular-nums">{formatCOP(kpis.saldoAFavorClub)}</p>
          </CardContent>
        </Card>
      </div>

      {/* b. Resumen de egresos del mes. */}
      <Card>
        <CardHeader>
          <CardTitle>Egresos de {formatMes(mesActual).toLowerCase()}</CardTitle>
          <CardAction>
            <Link href="/egresos" className="text-[13px] underline underline-offset-2">
              Ver todos
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-[24px] leading-tight font-bold tabular-nums">{formatCOP(egresos.total)}</p>
          {topCategorias.length === 0 ? (
            <p className="mt-1 text-muted-foreground">Sin egresos registrados este mes.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-[14px]">
              {topCategorias.map(([cat, monto]) => (
                <li key={cat} className="flex items-baseline justify-between gap-3">
                  <span className="text-muted-foreground">{CATEGORIA_EGRESO_LABEL[cat]}</span>
                  <span className="tabular-nums">{formatCOP(monto)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* c. Resumen de eventos de cobro, con barras de progreso. */}
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
                  <p className="flex items-center gap-2 text-[15px] font-semibold">
                    {e.nombre}
                    <CategoriaTag categoria={e.categoria} />
                  </p>
                  <p className="text-[13px] text-muted-foreground">vence {formatFecha(e.fecha_limite, true)}</p>
                </div>
                <ProgressBar value={p?.pagadas ?? 0} committed={p?.con_acuerdo ?? 0} total={p?.total ?? 0} className="mt-1" />
              </Link>
            )
          })}
        </CardContent>
      </Card>

      {/* d. Comprobantes que requieren revisión humana (la bandeja completa vive en /tesorero/comprobantes). */}
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
            <p className="text-muted-foreground">{items.length ? "Los pendientes traen propuesta clara." : "Sin comprobantes por revisar."}</p>
          ) : (
            <PendientesList items={requieren} reglas={nombresReglas} limit={8} hideMore />
          )}
        </CardContent>
      </Card>

      {/* e. Jugadores en mora. */}
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
                <li key={m.id} className="flex items-center gap-2">
                  <Link href={`/jugadores/${m.id}`} className="hover:underline">
                    {m.nombre}
                  </Link>
                  <CategoriaTag categoria={m.categoria} />
                </li>
              ))}
          </ul>
        </CardContent>
      </Card>

      <TareasPendientes clubId={s.club_id} />

      {/* f. Actividad reciente. */}
      <ActivityPanel />
    </div>
  )
}
