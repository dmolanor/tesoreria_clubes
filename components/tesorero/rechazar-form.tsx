"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ActionForm } from "@/components/action-form"
import { rechazarAction } from "@/app/actions/comprobantes"

export function RechazarForm({ comprobanteId }: { comprobanteId: string }) {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Rechazar…
      </Button>
    )
  }
  return (
    <ActionForm action={rechazarAction} className="space-y-2">
      {(pending) => (
        <>
          <input type="hidden" name="comprobante_id" value={comprobanteId} />
          <Label htmlFor="motivo">Motivo del rechazo (el jugador lo verá)</Label>
          <Textarea id="motivo" name="motivo" required rows={2} placeholder="Ej: el valor no coincide con la transferencia recibida en el banco" />
          <div className="flex gap-2">
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Rechazando…" : "Rechazar comprobante"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </>
      )}
    </ActionForm>
  )
}
