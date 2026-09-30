import Link from "next/link"
import { notFound } from "next/navigation"
import { pageSession } from "@/lib/auth/page"
import { bandeja, reglasDelClub } from "@/lib/db/tesoreria"
import { comprobantesDe, estadoCuenta, urlsFirmadas } from "@/lib/db/cuenta"
import { formatCOP, formatFecha } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusDot } from "@/components/status-dot"
import { DesgloseEditor, type FilaDesglose } from "@/components/tesorero/desglose-editor"
import { RechazarForm } from "@/components/tesorero/rechazar-form"

export default async function RevisarComprobante(props: PageProps<"/tesorero/comprobantes/[id]">) {
  const s = await pageSession("tesorero")
  const sb = s.supabase
  const { id } = await props.params
  const { data: base } = await sb
    .from("comprobantes")
    .select("id, club_id, miembro_id, estado, miembros!comprobantes_club_id_miembro_id_fkey(nombre), revisor:miembros!comprobantes_club_id_revisado_por_fkey(nombre)")
    .eq("id", id)
    .maybeSingle()
  if (!base || base.club_id !== s.club_id) notFound()

  const [[c], cuenta, pendiente, reglas] = await Promise.all([
    comprobantesDe(sb, { ids: [id] }),
    estadoCuenta(sb, s.club_id, base.miembro_id),
    base.estado === "pendiente" ? bandeja(sb, s.club_id, { id }).then((r) => r[0]) : Promise.resolve(undefined),
    reglasDelClub(sb, s.club_id),
  ])
  const urls = await urlsFirmadas(sb, [c.archivo_path])
  const href = c.archivo_path ? urls.get(c.archivo_path) : undefined
  const nombreRegla = new Map(reglas.map((r) => [r.id, r.nombre]))

  const filas: FilaDesglose[] = (pendiente?.pendientes ?? []).map((p) => {
    const lineas = pendiente!.propuesta.lineas.filter((l) => l.obligacion_id === p.obligacion_id)
    const regla = lineas[0]?.regla_aplicada ? nombreRegla.get(lineas[0].regla_aplicada) : undefined
    return {
      obligacion_id: p.obligacion_id,
      evento: p.evento,
      fecha_limite: p.fecha_limite,
      saldo: p.saldo_pendiente,
      propuesto: lineas.reduce((sum, l) => sum + l.monto_aplicado, 0),
      regla: regla ? `propuesto por "${regla}"` : null,
    }
  })

  return (
    <div className="space-y-4">
      <Link href="/tesorero/comprobantes" className="text-[13px] text-muted-foreground hover:underline">
        ← Comprobantes
      </Link>
      <div className="grid gap-6 md:grid-cols-[minmax(0,340px)_1fr]">
        <Card>
          <CardContent>
            {href ? (
              c.archivo_path?.endsWith(".pdf") ? (
                <a href={href} target="_blank" className="underline">
                  Abrir PDF del comprobante
                </a>
              ) : (
                <a href={href} target="_blank">
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage, temporal */}
                  <img src={href} alt={`Comprobante de ${base.miembros?.nombre}`} className="w-full rounded-md border border-border" />
                </a>
              )
            ) : (
              <p className="text-muted-foreground">Sin archivo (dato demo)</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {base.miembros?.nombre} · <span className="tabular-nums">{formatCOP(c.monto)}</span>
            </CardTitle>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
              <span>Pagó el {formatFecha(c.fecha_pago)}</span>
              <StatusDot estado={cuenta.estado} label />
              <span>debe {formatCOP(cuenta.total_pendiente)}</span>
              {cuenta.saldo_a_favor > 0 ? <span>· {formatCOP(cuenta.saldo_a_favor)} a favor</span> : null}
              <Link href={`/jugadores/${base.miembro_id}`} className="underline underline-offset-2">
                ver jugador
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {pendiente ? (
              <>
                <h3 className="mb-1 text-[15px] font-semibold">Cómo se aplicaría</h3>
                <DesgloseEditor comprobanteId={c.id} monto={c.monto} filas={filas} />
                <div className="mt-4 border-t border-border pt-4">
                  <RechazarForm comprobanteId={c.id} />
                </div>
              </>
            ) : (
              <>
                <p className="mb-2">
                  {c.estado === "aceptado" ? "Aceptado" : "Rechazado"} por {base.revisor?.nombre ?? "—"}
                  {c.revisado_en ? ` el ${formatFecha(c.revisado_en)}` : ""}
                </p>
                {c.estado === "rechazado" ? <p>Motivo: {c.motivo_rechazo}</p> : null}
                <ul className="divide-y divide-border">
                  {c.desglose.map((d, i) => (
                    <li key={i} className="flex justify-between gap-3 py-2">
                      <span>
                        {d.evento} <span className="text-[13px] text-muted-foreground">({d.regla})</span>
                      </span>
                      <span className="tabular-nums">{formatCOP(d.monto)}</span>
                    </li>
                  ))}
                  {c.saldo_a_favor > 0 ? (
                    <li className="flex justify-between gap-3 py-2">
                      <span>Saldo a favor</span>
                      <span className="tabular-nums">{formatCOP(c.saldo_a_favor)}</span>
                    </li>
                  ) : null}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
