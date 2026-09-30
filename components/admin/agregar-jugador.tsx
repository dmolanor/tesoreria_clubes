"use client"

import { useState } from "react"
import { UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/native-select"
import { ActionForm } from "@/components/action-form"
import { agregarJugadorAction } from "@/app/actions/jugadores"

/** Alta de un jugador: se crea en el club y recibe la invitación por correo. */
export function AgregarJugador({ categorias }: { categorias: string[] }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlus /> Agregar jugador
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar jugador</DialogTitle>
          <DialogDescription>Le llega un correo con el enlace para entrar. El celular lo deja la persona al aceptar la invitación.</DialogDescription>
        </DialogHeader>
        <ActionForm action={agregarJugadorAction} onSuccess={() => setOpen(false)} resetOnSuccess className="space-y-4">
          {(pending) => (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="jugador-nombre">Nombre</Label>
                <Input id="jugador-nombre" name="nombre" required autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jugador-correo">Correo</Label>
                <Input id="jugador-correo" name="correo" type="email" required autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jugador-categoria">Categoría</Label>
                <NativeSelect id="jugador-categoria" name="categoria" defaultValue={categorias[0] ?? ""}>
                  {categorias.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                  <option value="">Sin categoría</option>
                </NativeSelect>
              </div>
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Enviando…" : "Agregar e invitar"}
              </Button>
            </>
          )}
        </ActionForm>
      </DialogContent>
    </Dialog>
  )
}
