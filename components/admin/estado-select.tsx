"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { NativeSelect } from "@/components/native-select"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cambiarEstadoAction } from "@/app/actions/jugadores"
import { hoyISO } from "@/lib/format"
import type { EstadoMiembro as EstadoJugador } from "@/lib/db/types"

const ETIQUETA: Record<EstadoJugador, string> = { activo: "Activo", lesionado: "Lesionado", retirado: "Retirado" }

/**
 * Pasar a activo aplica de inmediato. Lesionado o retirado pide la fecha real del cambio (por defecto
 * hoy), porque la base prorratea la mensualidad del mes de esa fecha.
 */
export function EstadoSelect({ usuarioId, estado }: { usuarioId: string; estado: EstadoJugador }) {
  const [pending, start] = useTransition()
  const [valor, setValor] = useState<EstadoJugador>(estado)
  const [pendiente, setPendiente] = useState<EstadoJugador | null>(null)
  const [hoy, setHoy] = useState(() => hoyISO())
  const [fecha, setFecha] = useState(hoy)

  function cambiar(nuevo: EstadoJugador, fechaEfectiva?: string) {
    setValor(nuevo)
    start(async () => {
      const r = await cambiarEstadoAction(usuarioId, nuevo, fechaEfectiva)
      if (r && !r.ok) {
        setValor(estado)
        toast.error(r.error)
      } else if (r?.message) toast.success(r.message)
    })
  }

  function cerrar() {
    setPendiente(null)
  }

  return (
    <>
      <NativeSelect
        aria-label="Estado del jugador"
        value={valor}
        disabled={pending}
        className="h-9 w-32"
        onChange={(e) => {
          const nuevo = e.target.value as EstadoJugador
          if (nuevo === "activo") return cambiar(nuevo)
          const h = hoyISO()
          setHoy(h)
          setFecha(h)
          setPendiente(nuevo)
        }}
      >
        <option value="activo">Activo</option>
        <option value="lesionado">Lesionado</option>
        <option value="retirado">Retirado</option>
      </NativeSelect>

      <Dialog open={pendiente !== null} onOpenChange={(open) => !open && cerrar()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar a {pendiente ? ETIQUETA[pendiente].toLowerCase() : ""}</DialogTitle>
            <DialogDescription>
              {estado === "activo"
                ? "La mensualidad del mes de esta fecha se cobra proporcional a los días que alcanzó a estar activo. Si ya estaba pagada, lo que sobre queda como saldo a favor."
                : "Esta fecha queda en la bitácora. No cambia ningún cobro."}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (!pendiente) return
              const nuevo = pendiente
              cerrar()
              cambiar(nuevo, fecha)
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor={`fecha-efectiva-${usuarioId}`}>¿Desde qué fecha?</Label>
              <Input
                id={`fecha-efectiva-${usuarioId}`}
                type="date"
                required
                max={hoy}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={cerrar}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-raza text-white hover:bg-raza/90">
                Cambiar estado
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
