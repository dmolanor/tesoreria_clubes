import { Check } from "lucide-react"
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
  if (estado === "parcial") {
    return (
      <span className={cn("inline-flex shrink-0 items-center", className)}>
        <span aria-hidden className="inline-block size-2.5 rounded-full border-[1.5px] border-ink" style={{ background: "linear-gradient(90deg, var(--raza) 50%, transparent 50%)" }} />
        <span className="sr-only">Parcial</span>
      </span>
    )
  }
  return <StatusDot estado={estado === "pagado" ? "al_dia" : estado === "vencido" ? "mora" : "pendiente"} className={cn("shrink-0", className)} />
}

/** Marcador de tarea: distinto al de los cobros (siempre lleva un ícono de check). */
function MarcadorTarea({ hecha, className }: { hecha: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex size-2.5 shrink-0 items-center justify-center rounded-full border-[1.5px]", hecha ? "border-raza bg-raza" : "border-ink border-dashed bg-transparent", className)}
    >
      <Check className={cn("size-2", hecha ? "text-white" : "text-ink")} strokeWidth={3} />
    </span>
  )
}

/** Calendario anual de cobros y tareas, solo lectura. Sin interactividad. */
export function CalendarioPagos({ año, meses, hoy = hoyISO() }: { año: number; meses: MesCalendario[]; hoy?: string }) {
  const mesHoy = hoy.slice(0, 7)
  const hayAlgo = meses.some((m) => m.items.length > 0 || m.tareas.length > 0)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendario de pagos {año}</CardTitle>
      </CardHeader>
      <CardContent>
        {!hayAlgo ? (
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
                    {m.tareas.length > 0 ? (
                      <ul className="mt-1.5 space-y-1 border-t border-border pt-1.5">
                        {m.tareas.map((t, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <MarcadorTarea hecha={t.hecha} className="mt-[3px]" />
                            <p className={cn("min-w-0 flex-1 truncate text-[12px] leading-snug", t.hecha && "text-faint line-through")}>
                              {t.dia} · {t.nombre}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                )
              })}
            </div>
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true"><Punto estado="pagado" /></span>
                Pagado
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true"><Punto estado="vencido" /></span>
                Vencido
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true"><Punto estado="pendiente" /></span>
                Pendiente
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true"><Punto estado="parcial" /></span>
                Parcial
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true"><Punto estado="estimado" /></span>
                Estimado
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true"><MarcadorTarea hecha={false} /></span>
                Tarea
              </span>
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
