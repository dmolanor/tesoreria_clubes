"use client"

import { useState } from "react"
import { FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ActionForm } from "@/components/action-form"
import { importarJugadoresAction } from "@/app/actions/jugadores"

export function ImportarJugadores() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileSpreadsheet /> Cargar jugadores (Excel)
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cargar jugadores</DialogTitle>
          <DialogDescription>
            Sube un .xlsx o .csv con columnas <strong>nombre</strong>, <strong>correo</strong> y <strong>categoría</strong> (Élite o Junior).
            Los correos que ya existen se omiten. Cargar no envía correos; después invita a los nuevos con el botón “Invitar a los N sin cuenta” del inicio.
          </DialogDescription>
        </DialogHeader>
        <ActionForm action={importarJugadoresAction} onSuccess={() => setOpen(false)} className="space-y-4">
          {(pending) => (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="archivo-jugadores">Archivo</Label>
                <Input id="archivo-jugadores" name="archivo" type="file" required accept=".xlsx,.csv" />
              </div>
              <a href="/plantilla-jugadores.csv" className="block text-[13px] underline underline-offset-2">
                Descargar plantilla de ejemplo (.csv)
              </a>
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Cargando…" : "Cargar"}
              </Button>
            </>
          )}
        </ActionForm>
      </DialogContent>
    </Dialog>
  )
}
