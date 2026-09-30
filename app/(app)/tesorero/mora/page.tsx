import Link from "next/link"
import { pageSession } from "@/lib/auth/page"
import { enMora } from "@/lib/db/tesoreria"
import { categoriasDelClub } from "@/lib/db/admin"
import { deudoresConDetalle, proximasCuotas, reglasDelClub, vencimientosEn } from "@/lib/db/recordatorios"
import { mensajeAcuerdo, mensajeGrupalMora, mensajeVencimiento } from "@/lib/recordatorios"
import { diasEntre, formatFecha, hoyISO } from "@/lib/format"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ReglasRecordatorio } from "@/components/tesorero/reglas-recordatorio"
import { CopiarMensaje } from "@/components/tesorero/copiar-mensaje"

// Solo nombres, sin montos (decisión del club: la lista se comparte con el grupo).
export default async function MoraPage() {
  const s = await pageSession("tesorero")
  const hoy = hoyISO()
  const [mora, categorias, reglas, deudores, cuotas] = await Promise.all([
    enMora(s.supabase, s.club_id, hoy),
    categoriasDelClub(s.supabase, s.club_id),
    reglasDelClub(s.supabase, s.club_id),
    deudoresConDetalle(s.supabase, s.club_id, hoy),
    proximasCuotas(s.supabase, s.club_id, hoy),
  ])
  const diasAntes = Math.max(0, ...reglas.filter((r) => r.activa && r.tipo === "previo_vencimiento").map((r) => r.dias_antes ?? 0))
  const vencimientos = diasAntes > 0 ? await vencimientosEn(s.supabase, s.club_id, hoy, diasAntes) : []

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Jugadores en mora ({mora.length})</CardTitle>
          <CardDescription>Solo nombres, sin montos. Esta lista es la que se comparte con el grupo.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          {categorias.map((cat) => {
            const lista = mora.filter((m) => m.categoria === cat)
            return (
              <div key={cat}>
                <h3 className="label-caps mb-2">
                  {cat} · {lista.length}
                </h3>
                <ul className="space-y-1.5">
                  {lista.map((m) => (
                    <li key={m.id} className="flex items-baseline justify-between gap-3">
                      <Link href={`/jugadores/${m.id}`} className="hover:underline">
                        {m.nombre}
                      </Link>
                      <span className="text-[13px] text-muted-foreground">
                        {m.vencidas} {m.vencidas === 1 ? "cobro" : "cobros"} · desde {formatFecha(m.desde, true)} ({diasEntre(m.desde, hoy)} días)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recordatorios</CardTitle>
          <CardDescription>Configura cuándo recordar y copia el mensaje listo para el grupo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ReglasRecordatorio reglas={reglas} />

          <div className="space-y-4">
            <h3 className="text-[15px] font-semibold">Mensaje grupal por categoría</h3>
            {categorias.map((cat) => {
              const lista = deudores.filter((d) => d.categoria === cat && d.deudas.length > 0)
              if (!lista.length) return null
              const texto = mensajeGrupalMora(cat, hoy, lista)
              return (
                <div key={cat} className="space-y-2">
                  <pre className="rounded-lg border border-border bg-muted/60 p-3 font-sans text-[13px] whitespace-pre-wrap">{texto}</pre>
                  <CopiarMensaje texto={texto} />
                </div>
              )
            })}
            {deudores.every((d) => d.deudas.length === 0) ? <p className="text-muted-foreground">Nadie en mora.</p> : null}
          </div>

          {vencimientos.some((v) => v.pendientes.length) ? (
            <div className="space-y-4">
              <h3 className="text-[15px] font-semibold">Próximos vencimientos</h3>
              {vencimientos
                .filter((v) => v.pendientes.length)
                .map((v) => {
                  const texto = mensajeVencimiento(v.evento, v.fecha_limite, v.monto, v.pendientes)
                  return (
                    <div key={v.evento_id} className="space-y-2">
                      <pre className="rounded-lg border border-border bg-muted/60 p-3 font-sans text-[13px] whitespace-pre-wrap">{texto}</pre>
                      <CopiarMensaje texto={texto} />
                    </div>
                  )
                })}
            </div>
          ) : null}

          {cuotas.length ? (
            <div className="space-y-4">
              <h3 className="text-[15px] font-semibold">Cuotas de acuerdos (próximos 7 días)</h3>
              {cuotas.map((c, i) => {
                const texto = mensajeAcuerdo(c.miembro, c.evento, c.monto, c.fecha)
                return (
                  <div key={i} className="space-y-2">
                    <pre className="rounded-lg border border-border bg-muted/60 p-3 font-sans text-[13px] whitespace-pre-wrap">{texto}</pre>
                    <CopiarMensaje texto={texto} />
                  </div>
                )
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
