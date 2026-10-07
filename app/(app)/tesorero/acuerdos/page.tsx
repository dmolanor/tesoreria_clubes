import { pageSession } from "@/lib/auth/page"
import { acuerdosDelClub } from "@/lib/db/acuerdos"
import { opcionesJugadores } from "@/lib/db/admin"
import { pendientesPorMiembro } from "@/lib/db/tesoreria"
import { urlsFirmadas } from "@/lib/db/cuenta"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AcuerdoItem } from "@/components/tesorero/acuerdo-item"
import { NuevoAcuerdo, type JugadorDeuda } from "@/components/tesorero/nuevo-acuerdo"
import { ActivityPanel } from "@/components/activity-panel"
import { formatCOP, formatFecha } from "@/lib/format"

export default async function AcuerdosPage() {
  const s = await pageSession("tesorero")
  const sb = s.supabase
  const [acuerdos, jugadores] = await Promise.all([acuerdosDelClub(sb, s.club_id), opcionesJugadores(sb, s.club_id)])
  const pendientes = await pendientesPorMiembro(sb, jugadores.map((j) => j.id))
  const conDeudas: JugadorDeuda[] = jugadores.flatMap((j) => {
    const obligaciones = (pendientes.get(j.id) ?? []).map((p) => ({
      id: p.obligacion_id,
      evento: p.evento,
      saldo: p.saldo_pendiente,
      fecha_limite: p.fecha_limite,
    }))
    return obligaciones.length ? [{ id: j.id, nombre: j.nombre, obligaciones }] : []
  })
  const activos = acuerdos.filter((a) => a.estado === "activo")
  const cancelados = acuerdos.filter((a) => a.estado !== "activo")
  const urls = await urlsFirmadas(sb, activos.map((a) => a.evidencia_path))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted-foreground">
          {activos.length} {activos.length === 1 ? "acuerdo activo" : "acuerdos activos"} · el jugador ve los suyos en su estado de cuenta
        </p>
        <NuevoAcuerdo jugadores={conDeudas} />
      </div>

      {activos.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-muted-foreground">Sin acuerdos activos. Registra el primero con “Nuevo acuerdo”.</p>
          </CardContent>
        </Card>
      ) : (
        activos.map((a) => <AcuerdoItem key={a.id} acuerdo={a} evidenciaUrl={urls.get(a.evidencia_path)} />)
      )}

      {cancelados.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Cancelados ({cancelados.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {cancelados.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-[14px]">
                  <span>
                    {a.miembro} · {a.evento}
                  </span>
                  <span className="text-[13px] text-muted-foreground tabular-nums">
                    {formatCOP(a.cuotas.reduce((s, c) => s + c.monto, 0))} · registrado el {formatFecha(a.created_at, true)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <ActivityPanel tipos={["acuerdo_pago_cambiado"]} />
    </div>
  )
}
