"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ActionForm } from "@/components/action-form"
import { completarRegistroAction } from "@/app/actions/registro"

export function CompletarRegistroForm({ nombre }: { nombre: string }) {
  return (
    <ActionForm action={completarRegistroAction} className="space-y-4">
      {(pending) => (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" name="nombre" required autoComplete="name" defaultValue={nombre} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telefono">Celular</Label>
            <Input id="telefono" name="telefono" type="tel" inputMode="tel" required autoComplete="tel" placeholder="300 123 4567" />
          </div>
          <Button type="submit" disabled={pending} className="w-full bg-raza text-white hover:bg-raza/90">
            {pending ? "Guardando…" : "Guardar y entrar"}
          </Button>
          <Link
            href="/"
            className="flex h-11 items-center justify-center rounded-lg text-[13px] underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-raza"
          >
            Ahora no
          </Link>
        </>
      )}
    </ActionForm>
  )
}
