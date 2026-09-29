import Link from "next/link"
import { getStore } from "@/lib/data"
import { pageSession } from "@/lib/auth/page"
import { diasEntre, formatCOP, formatFecha, hoyISO, relativoVencimiento } from "@/lib/format"
import { progresoEvento } from "@/lib/views"
import { opcionesJugadores } from "@/lib/admin"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ProgressBar } from "@/components/progress-bar"
import { NuevoEvento } from "@/components/admin/nuevo-evento"
import { ImportarJugadores } from "@/components/admin/importar-jugadores"
import { ActivityPanel } from "@/components/activity-panel"

const UMBRAL_RECAUDO = 0.8 // por debajo de esto, un evento cercano a vencer necesita seguimiento
const VENTANA_DIAS = 14

export default async function AdminHome() {
  const s = await pageSession("administrativo")
  const db = await getStore().read()
  const hoy = hoyISO()

  const atencion = db.eventos_cobro
    .filter((e) => e.club_id === s.club_id && e.estado === "activo")
    .map((e) => ({ e, p: progresoEvento(db, e.id), dias: diasEntre(hoy, e.fecha_limite) }))
    .filter(({ p, dias }) => dias <= VENTANA_DIAS && dias >= -30 && p.pagados / Math.max(1, p.total) < UMBRAL_RECAUDO)
    .sort((a, b) => a.dias - b.dias)

  const cambios = db.bitacora
    .filter((b) => b.club_id === s.club_id && (b.tipo === "jugador_estado_cambiado" || b.tipo === "jugador_creado"))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <NuevoEvento jugadores={opcionesJugadores(db, s.club_id)} />
        <ImportarJugadores />
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
            <p className="text-muted-foreground">Nada urgente: los cobros cercanos van bien.</p>
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
                    <ProgressBar value={p.pagados} total={p.total} className="mt-1" />
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      {formatCOP(p.recaudado)} recaudados de {formatCOP(p.montoTotal)}
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
          {cambios.length === 0 ? (
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
      <ActivityPanel />
    </div>
  )
}
