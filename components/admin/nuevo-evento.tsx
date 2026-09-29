"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/native-select"
import { ActionForm } from "@/components/action-form"
import { crearEventoAction } from "@/app/actions/eventos"
import type { Alcance } from "@/lib/data/types"

export interface JugadorOpcion {
  id: string
  nombre: string
  categoria: string | null
}

export function NuevoEvento({ jugadores }: { jugadores: JugadorOpcion[] }) {
  const [open, setOpen] = useState(false)
  const [alcance, setAlcance] = useState<Alcance>("todos")
  const [filtro, setFiltro] = useState("")
  const visibles = jugadores.filter((j) => j.nombre.toLowerCase().includes(filtro.toLowerCase()))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-raza text-white hover:bg-raza/90">
          <Plus /> Nuevo evento de cobro
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo evento de cobro</DialogTitle>
          <DialogDescription>Se crea una obligación para cada jugador activo del alcance. Si alguno tiene saldo a favor, se aplica de inmediato.</DialogDescription>
        </DialogHeader>
        <ActionForm action={crearEventoAction} onSuccess={() => setOpen(false)} className="space-y-4">
          {(pending) => (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="nombre">Nombre</Label>
                <Input id="nombre" name="nombre" required placeholder="Mensualidad octubre · Élite" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="monto">Monto por jugador</Label>
                  <Input id="monto" name="monto" inputMode="numeric" required placeholder="120000" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fecha_limite">Fecha límite</Label>
                  <Input id="fecha_limite" name="fecha_limite" type="date" required />
                </div>
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">¿A quién se le cobra?</legend>
                <div className="flex flex-wrap gap-2">
                  {(["todos", "grupo", "individual"] as const).map((a) => (
                    <label key={a} className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 has-checked:border-ink has-checked:font-medium">
                      <input type="radio" name="alcance" value={a} checked={alcance === a} onChange={() => setAlcance(a)} className="accent-(--raza)" />
                      {a === "todos" ? "Todos" : a === "grupo" ? "Una categoría" : "Jugadores específicos"}
                    </label>
                  ))}
                </div>
                {alcance === "grupo" ? (
                  <NativeSelect name="categoria" aria-label="Categoría">
                    <option>Élite</option>
                    <option>Junior</option>
                  </NativeSelect>
                ) : null}
                {alcance === "individual" ? (
                  <div className="space-y-2">
                    <Input placeholder="Buscar jugador…" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Buscar jugador" />
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-border p-2">
                      {jugadores.map((j) => (
                        <label key={j.id} className={visibles.includes(j) ? "flex items-center gap-2 py-1" : "hidden"}>
                          <input type="checkbox" name="jugadores" value={j.id} className="size-4 accent-(--raza)" />
                          {j.nombre} <span className="text-[13px] text-muted-foreground">{j.categoria}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </fieldset>
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Creando…" : "Crear evento"}
              </Button>
            </>
          )}
        </ActionForm>
      </DialogContent>
    </Dialog>
  )
}
