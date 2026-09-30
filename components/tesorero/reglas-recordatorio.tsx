"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/native-select"
import { ActionForm } from "@/components/action-form"
import { ActionButton } from "@/components/action-button"
import { crearReglaAction, editarReglaAction, eliminarReglaAction, toggleReglaAction } from "@/app/actions/recordatorios"
import type { ReglaRecordatorio, TipoRecordatorio } from "@/lib/db/types"
import { cn } from "@/lib/utils"

const TIPO_LABEL: Record<TipoRecordatorio, string> = {
  mensual: "Día del mes",
  previo_vencimiento: "Antes del vencimiento",
  acuerdo_pago: "Cuotas de acuerdos",
}

function descripcion(r: ReglaRecordatorio): string {
  if (r.tipo === "mensual") return `cada mes, el día ${r.dia_mes}`
  if (r.tipo === "previo_vencimiento") return `${r.dias_antes} ${r.dias_antes === 1 ? "día" : "días"} antes del límite`
  return "en fechas de cuotas pactadas"
}

function ReglaForm({
  regla,
  onDone,
}: {
  regla?: ReglaRecordatorio
  onDone: () => void
}) {
  const [tipo, setTipo] = useState<TipoRecordatorio>(regla?.tipo ?? "mensual")
  return (
    <ActionForm action={regla ? editarReglaAction : crearReglaAction} onSuccess={onDone} className="space-y-4">
      {(pending) => (
        <>
          {regla ? <input type="hidden" name="id" value={regla.id} /> : null}
          <div className="space-y-1.5">
            <Label htmlFor={regla ? `nombre-${regla.id}` : "nombre"}>Nombre</Label>
            <Input id={regla ? `nombre-${regla.id}` : "nombre"} name="nombre" required defaultValue={regla?.nombre ?? ""} placeholder="Mensualidad día 5" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={regla ? `tipo-${regla.id}` : "tipo"}>Tipo</Label>
            <NativeSelect id={regla ? `tipo-${regla.id}` : "tipo"} name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoRecordatorio)}>
              {(Object.keys(TIPO_LABEL) as TipoRecordatorio[]).map((t) => (
                <option key={t} value={t}>
                  {TIPO_LABEL[t]}
                </option>
              ))}
            </NativeSelect>
          </div>
          {tipo === "mensual" ? (
            <div className="space-y-1.5">
              <Label htmlFor={regla ? `dia-${regla.id}` : "dia"}>Día del mes</Label>
              <Input id={regla ? `dia-${regla.id}` : "dia"} name="dia_mes" type="number" min={1} max={28} required defaultValue={regla?.dia_mes ?? 5} />
            </div>
          ) : null}
          {tipo === "previo_vencimiento" ? (
            <div className="space-y-1.5">
              <Label htmlFor={regla ? `antes-${regla.id}` : "antes"}>Días antes del vencimiento</Label>
              <Input id={regla ? `antes-${regla.id}` : "antes"} name="dias_antes" type="number" min={1} max={30} required defaultValue={regla?.dias_antes ?? 3} />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor={regla ? `canal-${regla.id}` : "canal"}>Canal</Label>
            <NativeSelect id={regla ? `canal-${regla.id}` : "canal"} name="canal" defaultValue={regla?.canal ?? "whatsapp"}>
              <option value="whatsapp">WhatsApp</option>
              <option value="correo">Correo</option>
            </NativeSelect>
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Guardando…" : regla ? "Guardar cambios" : "Crear recordatorio"}
          </Button>
        </>
      )}
    </ActionForm>
  )
}

export function ReglasRecordatorio({ reglas }: { reglas: ReglaRecordatorio[] }) {
  const [crearOpen, setCrearOpen] = useState(false)
  const [editarId, setEditarId] = useState<string | null>(null)
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog open={crearOpen} onOpenChange={setCrearOpen}>
          <DialogTrigger asChild>
            <Button className="bg-raza text-white hover:bg-raza/90">
              <Plus /> Nuevo recordatorio
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo recordatorio</DialogTitle>
            </DialogHeader>
            <ReglaForm onDone={() => setCrearOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
      {reglas.length === 0 ? <p className="text-muted-foreground">Sin recordatorios configurados.</p> : null}
      <ul className="divide-y divide-border">
        {reglas.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className={cn(!r.activa && "opacity-60")}>
              <p className="text-[15px] font-semibold">
                {r.nombre} {!r.activa ? <span className="text-[13px] font-medium text-muted-foreground">(pausado)</span> : null}
              </p>
              <p className="text-[13px] text-muted-foreground">
                {TIPO_LABEL[r.tipo]} · {descripcion(r)} · por {r.canal === "correo" ? "correo" : "WhatsApp"}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Dialog open={editarId === r.id} onOpenChange={(o) => setEditarId(o ? r.id : null)}>
                <DialogTrigger asChild>
                  <Button variant="outline">Editar</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Editar recordatorio</DialogTitle>
                  </DialogHeader>
                  <ReglaForm regla={r} onDone={() => setEditarId(null)} />
                </DialogContent>
              </Dialog>
              <ActionButton variant="outline" action={toggleReglaAction.bind(null, r.id, !r.activa)}>
                {r.activa ? "Pausar" : "Activar"}
              </ActionButton>
              <ActionButton variant="ghost" confirm="Confirmar eliminación" action={eliminarReglaAction.bind(null, r.id)}>
                Eliminar
              </ActionButton>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
