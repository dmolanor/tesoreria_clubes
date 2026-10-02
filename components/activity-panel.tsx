"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { ChevronDown } from "lucide-react"
import { actoresBitacora, cargarBitacora, type BitacoraItem } from "@/app/actions/bitacora"
import { TIPOS_BITACORA, type TipoBitacora } from "@/lib/db/types"
import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/native-select"
import { Input } from "@/components/ui/input"
import { formatFecha } from "@/lib/format"

const TIPO_LABEL: Record<TipoBitacora, string> = {
  evento_cobro_creado: "Evento creado",
  evento_cobro_cancelado: "Evento cancelado",
  jugador_creado: "Jugador creado",
  jugador_estado_cambiado: "Cambio de estado",
  comprobante_subido: "Comprobante subido",
  comprobante_aceptado: "Comprobante aceptado",
  comprobante_rechazado: "Comprobante rechazado",
  conciliacion_guardada: "Conciliación",
  regla_conciliacion_cambiada: "Regla cambiada",
  egreso_registrado: "Egreso registrado",
  egreso_anulado: "Egreso anulado",
  acuerdo_pago_cambiado: "Acuerdo de pago",
  tarea_creada: "Tarea creada",
  tarea_cancelada: "Tarea cancelada",
}

/**
 * Bitácora como sección colapsable dentro de cada vista (nunca pestaña propia).
 * `tipos` limita el contexto (ej. en Jugadores solo eventos de jugadores).
 */
export function ActivityPanel({ tipos, titulo = "Actividad reciente" }: { tipos?: TipoBitacora[]; titulo?: string }) {
  const disponibles = tipos ?? [...TIPOS_BITACORA]
  const tiposKey = disponibles.join(",")
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<BitacoraItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [tipo, setTipo] = useState<TipoBitacora | "">("")
  const [actor, setActor] = useState("")
  const [desde, setDesde] = useState("")
  const [actores, setActores] = useState<Array<{ id: string; nombre: string }>>([])
  const [pending, start] = useTransition()

  const load = useCallback(
    (reset: boolean, from: string | null) =>
      start(async () => {
        const r = await cargarBitacora({
          cursor: reset ? null : from,
          tipos: tipo ? [tipo] : (tiposKey.split(",") as TipoBitacora[]),
          actor_id: actor || null,
          desde: desde || null,
        })
        setItems((prev) => (reset ? r.items : [...prev, ...r.items]))
        setCursor(r.nextCursor)
      }),
    [tipo, actor, desde, tiposKey],
  )

  useEffect(() => {
    if (open) load(true, null)
  }, [open, load])

  useEffect(() => {
    if (open && actores.length === 0) actoresBitacora().then(setActores)
  }, [open, actores.length])

  return (
    <section className="rounded-[12px] border border-border bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-[18px] font-bold focus-visible:ring-2 focus-visible:ring-raza focus-visible:outline-none"
      >
        {titulo}
        <ChevronDown className={`size-4 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="border-t border-border px-4 pb-4">
          <div className="grid gap-2 py-3 sm:grid-cols-3">
            <NativeSelect aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoBitacora | "")}>
              <option value="">Todos los tipos</option>
              {disponibles.map((t) => (
                <option key={t} value={t}>
                  {TIPO_LABEL[t]}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect aria-label="Quién" value={actor} onChange={(e) => setActor(e.target.value)}>
              <option value="">Cualquier persona</option>
              {actores.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </NativeSelect>
            <Input aria-label="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          {items.length === 0 && !pending ? <p className="text-muted-foreground">Sin actividad con estos filtros.</p> : null}
          <ul className="divide-y divide-border">
            {items.map((b) => (
              <li key={b.id} className="py-2">
                <p>{b.descripcion}</p>
                <p className="text-[13px] text-muted-foreground">
                  {TIPO_LABEL[b.tipo]} · {formatFecha(b.created_at)}
                </p>
              </li>
            ))}
          </ul>
          {cursor ? (
            <Button variant="outline" className="mt-2" disabled={pending} onClick={() => load(false, cursor)}>
              {pending ? "Cargando…" : "Cargar más"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
