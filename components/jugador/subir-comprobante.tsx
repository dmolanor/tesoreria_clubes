"use client"

import { useState } from "react"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ActionForm } from "@/components/action-form"
import { subirComprobanteAction } from "@/app/actions/comprobantes"

export function SubirComprobante({ sugerido }: { sugerido?: number }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="h-12 w-full bg-raza text-white hover:bg-raza/90 sm:w-auto sm:px-6">
          <Upload /> Subir comprobante
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subir comprobante</DialogTitle>
          <DialogDescription>
            Escribe el monto total que transferiste. No tienes que elegir a qué cobro va: la tesorería lo aplica según
            las reglas del club.
          </DialogDescription>
        </DialogHeader>
        <ActionForm action={subirComprobanteAction} onSuccess={() => setOpen(false)} className="space-y-4">
          {(pending) => (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="monto">Monto transferido (COP)</Label>
                <Input id="monto" name="monto" inputMode="numeric" required placeholder={sugerido ? String(sugerido) : "180000"} autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="archivo">Foto o PDF del comprobante</Label>
                <Input id="archivo" name="archivo" type="file" required accept="image/*,application/pdf" />
              </div>
              <Button type="submit" disabled={pending} className="w-full bg-raza text-white hover:bg-raza/90">
                {pending ? "Enviando…" : "Enviar comprobante"}
              </Button>
            </>
          )}
        </ActionForm>
      </DialogContent>
    </Dialog>
  )
}
