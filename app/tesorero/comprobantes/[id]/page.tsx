import Link from "next/link"
import { notFound } from "next/navigation"
import { getStore } from "@/lib/data"
import { pageSession } from "@/lib/auth/page"
import { estadoCuenta, nombreUsuario, pendientesDe, propuestaPara, saldoAFavorDisponible } from "@/lib/domain/ledger"
import { archivoHref, desgloseAplicado } from "@/lib/views"
import { formatCOP, formatFecha, hoyISO } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusDot } from "@/components/status-dot"
import { DesgloseEditor, type FilaDesglose } from "@/components/tesorero/desglose-editor"
import { RechazarForm } from "@/components/tesorero/rechazar-form"

export default async function RevisarComprobante(props: PageProps<"/tesorero/comprobantes/[id]">) {
  const s = await pageSession("tesorero")
  const { id } = await props.params
  const db = await getStore().read()
  const c = db.comprobantes.find((c) => c.id === id)
  const jugador = c && db.usuarios.find((u) => u.id === c.usuario_id && u.club_id === s.club_id)
  if (!c || !jugador) notFound()

  const hoy = hoyISO()
  const cuenta = estadoCuenta(db, jugador.id, hoy)
  const href = archivoHref(c)
  const evento = (eid: string) => db.eventos_cobro.find((e) => e.id === eid)!.nombre

  let filas: FilaDesglose[] = []
  if (c.estado === "pendiente") {
    const propuesta = propuestaPara(db, c.id)
    filas = pendientesDe(db, jugador.id).map((p) => {
      const lineas = propuesta.lineas.filter((l) => l.obligacion_id === p.obligacion_id)
      const regla = db.reglas_conciliacion.find((r) => r.id === lineas[0]?.regla_aplicada)
      return {
        obligacion_id: p.obligacion_id,
        evento: evento(p.evento_cobro_id),
        fecha_limite: p.fecha_limite,
        saldo: p.saldo_pendiente,
        propuesto: lineas.reduce((s, l) => s + l.monto_aplicado, 0),
        regla: regla ? `propuesto por "${regla.nombre}"` : null,
      }
    })
  }

  return (
    <div className="space-y-4">
      <Link href="/tesorero/comprobantes" className="text-[13px] text-muted-foreground hover:underline">
        ← Comprobantes
      </Link>
      <div className="grid gap-6 md:grid-cols-[minmax(0,340px)_1fr]">
        <Card>
          <CardContent>
            {href ? (
              c.archivo_url?.endsWith(".pdf") ? (
                <a href={href} target="_blank" className="underline">
                  Abrir PDF del comprobante
                </a>
              ) : (
                <a href={href} target="_blank">
                  {/* eslint-disable-next-line @next/next/no-img-element -- archivo privado servido por /files */}
                  <img src={href} alt={`Comprobante de ${jugador.nombre}`} className="w-full rounded-md border border-border" />
                </a>
              )
            ) : (
              <p className="text-muted-foreground">Sin archivo</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {jugador.nombre} · <span className="tabular-nums">{formatCOP(c.monto_total)}</span>
              </CardTitle>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
                <span>Subido el {formatFecha(c.fecha_carga)}</span>
                <StatusDot estado={cuenta.estado} label />
                <span>debe {formatCOP(cuenta.totalPendiente)}</span>
                {saldoAFavorDisponible(db, jugador.id) > 0 ? <span>· {formatCOP(saldoAFavorDisponible(db, jugador.id))} a favor</span> : null}
                <Link href={`/jugadores/${jugador.id}`} className="underline underline-offset-2">
                  ver jugador
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {c.estado === "pendiente" ? (
                <>
                  <h3 className="mb-1 text-[15px] font-semibold">Cómo se aplicaría</h3>
                  <DesgloseEditor comprobanteId={c.id} monto={c.monto_total} filas={filas} />
                  <div className="mt-4 border-t border-border pt-4">
                    <RechazarForm comprobanteId={c.id} />
                  </div>
                </>
              ) : (
                <>
                  <p className="mb-2">
                    {c.estado === "aceptado" ? "Aceptado" : "Rechazado"} por {nombreUsuario(db, c.revisado_por)} el {formatFecha(c.revisado_en!)}
                  </p>
                  {c.estado === "rechazado" ? <p>Motivo: {c.motivo_rechazo}</p> : null}
                  <ul className="divide-y divide-border">
                    {desgloseAplicado(db, c.id).map((d) => (
                      <li key={d.id} className="flex justify-between gap-3 py-2">
                        <span>
                          {d.evento} <span className="text-[13px] text-muted-foreground">({d.regla})</span>
                        </span>
                        <span className="tabular-nums">{formatCOP(d.monto_aplicado)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
