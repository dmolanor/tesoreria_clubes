"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ActionForm } from "@/components/action-form"
import { condonarObligacionAction } from "@/app/actions/obligaciones"
import { formatCOP } from "@/lib/format"

/** Tesorería: deja el saldo pendiente de una obligación en $0. No se puede deshacer. */
export function CondonarObligacion({ obligacionId, saldo }: { obligacionId: string; saldo: number }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="h-auto p-0 text-[13px] font-normal underline underline-offset-2">
          Condonar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Condonar {formatCOP(saldo)}</DialogTitle>
          <DialogDescription>El saldo pendiente de esta obligación queda en $0. No se puede deshacer.</DialogDescription>
        </DialogHeader>
        <ActionForm action={condonarObligacionAction} onSuccess={() => setOpen(false)} className="space-y-4">
          {(pending) => (
            <>
              <input type="hidden" name="obligacion_id" value={obligacionId} />
              <div className="space-y-1.5">
                <Label htmlFor={`motivo-${obligacionId}`}>Motivo</Label>
                <Textarea id={`motivo-${obligacionId}`} name="motivo" required rows={3} />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending} className="bg-raza text-white hover:bg-raza/90">
                  {pending ? "Condonando…" : "Condonar"}
                </Button>
              </DialogFooter>
            </>
          )}
        </ActionForm>
      </DialogContent>
    </Dialog>
  )
}
