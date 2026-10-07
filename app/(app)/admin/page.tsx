import Link from "next/link"
import { Send } from "lucide-react"
import { pageSession } from "@/lib/auth/page"
import { categoriasDelClub, eventosDelClub, miembrosSinCuenta, opcionesJugadores, progresoEventos, tarifasDelClub } from "@/lib/db/admin"
import { kpisClub } from "@/lib/db/kpis"
import { diasEntre, formatCOP, formatFecha, formatMes, hoyISO, relativoVencimiento } from "@/lib/format"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ProgressBar } from "@/components/progress-bar"
import { NuevoEvento } from "@/components/admin/nuevo-evento"
import { ImportarJugadores } from "@/components/admin/importar-jugadores"
import { AgregarJugador } from "@/components/admin/agregar-jugador"
import { ActivityPanel } from "@/components/activity-panel"
import { TareasPendientes } from "@/components/tareas/tareas-pendientes"
import { ActionButton } from "@/components/action-button"
import { TarifasEstado } from "@/components/admin/tarifas-estado"
import { invitarPendientesAction } from "@/app/actions/jugadores"

const UMBRAL_RECAUDO = 0.8 // por debajo de esto, un evento cercano a vencer necesita seguimiento
const VENTANA_DIAS = 14

export default async function AdminHome() {
  const s = await pageSession("administrativo")
  const sb = s.supabase
  const hoy = hoyISO()
  const mesActual = `${hoy.slice(0, 7)}-01`
  const [eventos, progreso, jugadores, categorias, sinCuenta, tarifas, kpis, { data: cambios }] = await Promise.all([
    eventosDelClub(sb, s.club_id),
    progresoEventos(sb, s.club_id),
    opcionesJugadores(sb, s.club_id),
    categoriasDelClub(sb, s.club_id),
    miembrosSinCuenta(sb, s.club_id),
    tarifasDelClub(sb, s.club_id),
    kpisClub(sb, s.club_id, mesActual),
    sb
      .from("bitacora")
      .select("id, objetivo_id, descripcion, created_at")
      .eq("club_id", s.club_id)
      .in("tipo", ["jugador_estado_cambiado", "jugador_creado"])
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  const atencion = eventos
    .filter((e) => e.estado === "activo")
    .map((e) => ({ e, p: progreso.get(e.id), dias: diasEntre(hoy, e.fecha_limite) }))
    .filter(({ p, dias }) => p && dias <= VENTANA_DIAS && dias >= -30 && p.pagadas / Math.max(1, p.total) < UMBRAL_RECAUDO)
    .sort((a, b) => a.dias - b.dias)

  return (
    <div className="space-y-6">
      {/* KPIs de solo lectura (compartidos con el inicio del tesorero — ver lib/db/kpis.ts). Sin
          comprobantes pendientes: el admin no los gestiona. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent>
            <p className="text-[13px] font-medium text-muted-foreground">Recaudo de {formatMes(mesActual).toLowerCase()}</p>
            <p className="mt-1 text-[20px] leading-tight font-bold tabular-nums">{formatCOP(kpis.recaudo.recaudado)}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground tabular-nums">
              de {formatCOP(kpis.recaudo.totalEsperado)} · {kpis.recaudo.pct}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-[13px] font-medium text-muted-foreground">Jugadores en mora</p>
            <p className="mt-1 text-[20px] leading-tight font-bold tabular-nums">{kpis.jugadoresEnMora}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-[13px] font-medium text-muted-foreground">Monto en mora</p>
            <p className="mt-1 text-[20px] leading-tight font-bold tabular-nums text-warn">{formatCOP(kpis.montoEnMora)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-[13px] font-medium text-muted-foreground">Saldo a favor del club</p>
            <p className="mt-1 text-[20px] leading-tight font-bold tabular-nums">{formatCOP(kpis.saldoAFavorClub)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <NuevoEvento jugadores={jugadores} categorias={categorias} />
        <AgregarJugador categorias={categorias} />
        <ImportarJugadores />
        {sinCuenta > 0 ? (
          <ActionButton
            variant="outline"
            action={invitarPendientesAction}
            confirm={sinCuenta === 1 ? "¿Enviar 1 correo?" : `¿Enviar ${sinCuenta} correos?`}
          >
            <Send /> {sinCuenta === 1 ? "Invitar a 1 miembro sin cuenta" : `Invitar a los ${sinCuenta} sin cuenta`}
          </ActionButton>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cobros que necesitan seguimiento</CardTitle>
          <CardDescription>
            Vencen en los próximos {VENTANA_DIAS} días (o vencieron hace poco) y tienen menos del {UMBRAL_RECAUDO * 100}% pagado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {atencion.length === 0 ? (
            <p className="text-muted-foreground">Los cobros cercanos van bien.</p>
          ) : (
            <ul className="divide-y divide-border">
              {atencion.map(({ e, p }) => (
                <li key={e.id} className="py-3">
                  <Link href={`/eventos/${e.id}`} className="block hover:bg-muted/40">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[15px] font-semibold">{e.nombre}</span>
                      <span className={e.fecha_limite < hoy ? "text-[13px] font-medium text-warn" : "text-[13px] text-muted-foreground"}>
                        {relativoVencimiento(e.fecha_limite, hoy)} · {formatFecha(e.fecha_limite, true)}
                      </span>
                    </div>
                    <ProgressBar value={p!.pagadas} committed={p!.con_acuerdo} total={p!.total} className="mt-1" />
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      {formatCOP(p!.recaudado)} recaudados de {formatCOP(p!.monto_total)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cambios recientes de jugadores</CardTitle>
        </CardHeader>
        <CardContent>
          {!cambios?.length ? (
            <p className="text-muted-foreground">Sin cambios recientes.</p>
          ) : (
            <ul className="space-y-2">
              {cambios.map((b) => (
                <li key={b.id}>
                  <Link href={`/jugadores/${b.objetivo_id}`} className="hover:underline">
                    {b.descripcion}
                  </Link>
                  <span className="block text-[13px] text-muted-foreground">{formatFecha(b.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <TarifasEstado lesionado={tarifas.lesionado ?? null} inactivo={tarifas.inactivo ?? null} />
      <ActivityPanel />
      <TareasPendientes clubId={s.club_id} esAdmin />
    </div>
  )
}
