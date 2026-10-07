"use client"

import { useState } from "react"
import { HandCoins } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ActionForm } from "@/components/action-form"
import { registrarCruceAction } from "@/app/actions/cruces"
import { hoyISO } from "@/lib/format"

/** Tesorería: cruce de cuentas con un jugador que trabaja para el club (ej. entrena a cambio de un pago). */
export function RegistrarCruce({ miembroId, nombre }: { miembroId: string; nombre: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <HandCoins /> Registrar cruce
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cruce de cuentas con {nombre}</DialogTitle>
          <DialogDescription>
            Se registra como un comprobante de compensación (sin plata real) y un egreso de nómina. El monto se aplica a sus cobros pendientes con las
            mismas reglas de conciliación; lo que sobre queda como saldo a favor.
          </DialogDescription>
        </DialogHeader>
        <ActionForm action={registrarCruceAction} onSuccess={() => setOpen(false)} className="space-y-4">
          {(pending) => (
            <>
              <input type="hidden" name="miembro_id" value={miembroId} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cruce_monto">Monto (COP)</Label>
                  <Input id="cruce_monto" name="monto" inputMode="numeric" required placeholder="60000" autoComplete="off" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cruce_fecha">Fecha</Label>
                  <Input id="cruce_fecha" name="fecha" type="date" required defaultValue={hoyISO()} max={hoyISO()} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cruce_concepto">Concepto</Label>
                <Input id="cruce_concepto" name="concepto" required maxLength={200} placeholder="Entrenamiento septiembre" autoComplete="off" />
              </div>
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Registrando…" : "Registrar cruce"}
              </Button>
            </>
          )}
        </ActionForm>
      </DialogContent>
    </Dialog>
  )
}
