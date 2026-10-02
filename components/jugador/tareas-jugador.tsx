"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { marcarTareaAction } from "@/app/actions/tareas"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatFecha } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { TareaDeJugador } from "@/lib/db/tareas"

function Fila({ tarea }: { tarea: TareaDeJugador }) {
  const [pending, start] = useTransition()
  const hecha = tarea.completada_en !== null
  return (
    <li className={cn("flex items-start gap-2.5 py-2.5", hecha && "opacity-60")}>
      <input
        type="checkbox"
        aria-label={`Marcar "${tarea.nombre}" como ${hecha ? "pendiente" : "hecha"}`}
        className="mt-0.5 size-4 shrink-0 accent-(--raza)"
        disabled={pending}
        defaultChecked={hecha}
        onChange={(e) =>
          start(async () => {
            const r = await marcarTareaAction(tarea.id, e.target.checked)
            if (r && !r.ok) {
              toast.error(r.error)
              e.target.checked = !e.target.checked
            }
          })
        }
      />
      <div className="min-w-0 flex-1">
        <p className={cn("text-[14px] font-medium", hecha && "line-through")}>{tarea.nombre}</p>
        <p className="text-[13px] text-muted-foreground">
          vence {formatFecha(tarea.fecha_limite, true)} ·{" "}
          <a href={tarea.link} target="_blank" rel="noopener" className="underline underline-offset-2">
            abrir enlace
          </a>
        </p>
      </div>
    </li>
  )
}

/** Sección "Tareas" del jugador: solo marcar hecha/no hecha y abrir el enlace. Nada más. */
export function TareasJugador({ tareas }: { tareas: TareaDeJugador[] }) {
  if (tareas.length === 0) return null
  const ordenadas = [...tareas].sort((a, b) => Number(a.completada_en !== null) - Number(b.completada_en !== null))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tareas</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {ordenadas.map((t) => (
            <Fila key={t.id} tarea={t} />
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
