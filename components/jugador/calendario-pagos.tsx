import { StatusDot } from "@/components/status-dot"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { EstadoItemCalendario, MesCalendario } from "@/lib/calendario"
import { formatCOP, formatMes, hoyISO } from "@/lib/format"
import { cn } from "@/lib/utils"

/** 'Enero de 2026' → 'Ene'. */
function mesCorto(mes: string): string {
  return formatMes(mes).split(" ")[0].slice(0, 3)
}

function Punto({ estado, className }: { estado: EstadoItemCalendario; className?: string }) {
  if (estado === "estimado") {
    return (
      <span className={cn("inline-flex shrink-0 items-center", className)}>
        <span aria-hidden className="inline-block size-2.5 rounded-full border-[1.5px] border-faint bg-transparent" />
        <span className="sr-only">Estimado</span>
      </span>
    )
  }
  return <StatusDot estado={estado === "pagado" ? "al_dia" : "pendiente"} className={cn("shrink-0", className)} />
}

/** Calendario anual de cobros, solo lectura. Sin interactividad. */
export function CalendarioPagos({ año, meses, hoy = hoyISO() }: { año: number; meses: MesCalendario[]; hoy?: string }) {
  const mesHoy = hoy.slice(0, 7)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendario de pagos {año}</CardTitle>
      </CardHeader>
      <CardContent>
        {meses.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">Sin cobros este año.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {meses.map((m) => {
                const clave = m.mes.slice(0, 7)
                const actual = clave === mesHoy
                const pasado = clave < mesHoy
                return (
                  <div key={m.mes} className={cn("rounded-[12px] border border-border p-2.5", actual && "border-ink", pasado && "opacity-60")}>
                    <p className="text-[13px] font-semibold">{mesCorto(m.mes)}</p>
                    <ul className="mt-1.5 space-y-1.5">
                      {m.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <Punto estado={item.estado} className="mt-[3px]" />
                          <div className="min-w-0 flex-1 text-[12px] leading-snug">
                            <p className={cn("truncate", item.estado === "estimado" && "text-faint")}>
                              {item.dia != null ? `${item.dia} · ` : ""}
                              {item.nombre}
                            </p>
                            <p className="text-muted-foreground tabular-nums">{item.monto != null ? formatCOP(item.monto) : "por confirmar"}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Punto estado="pagado" /> Pagado
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Punto estado="pendiente" /> Pendiente
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Punto estado="estimado" /> Estimado
              </span>
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
