"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ActionForm } from "@/components/action-form"
import { editarEventoAction } from "@/app/actions/eventos"

export function EditarEvento({ id, nombre, fecha_limite }: { id: string; nombre: string; fecha_limite: string }) {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Editar
      </Button>
    )
  }
  return (
    <ActionForm action={editarEventoAction} onSuccess={() => setOpen(false)} className="grid w-full gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
      {(pending) => (
        <>
          <input type="hidden" name="id" value={id} />
          <div className="space-y-1.5">
            <Label htmlFor="e-nombre">Nombre</Label>
            <Input id="e-nombre" name="nombre" defaultValue={nombre} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-fecha">Fecha límite</Label>
            <Input id="e-fecha" name="fecha_limite" type="date" defaultValue={fecha_limite} required />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              Guardar
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
          <p className="text-[13px] text-muted-foreground sm:col-span-3">
            El monto y el alcance no se editan porque cambiarían deudas con pagos ya aplicados: cancela el evento y crea otro.
          </p>
        </>
      )}
    </ActionForm>
  )
}
