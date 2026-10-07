"use client"

import { useState } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/native-select"
import { Textarea } from "@/components/ui/textarea"
import { ActionForm } from "@/components/action-form"
import { crearAcuerdoAction } from "@/app/actions/acuerdos"
import { formatCOP, formatFecha } from "@/lib/format"

export interface DeudaOpcion {
  id: string
  evento: string
  saldo: number
  fecha_limite: string
}

export interface JugadorDeuda {
  id: string
  nombre: string
  obligaciones: DeudaOpcion[]
}

function siguienteMes(n: number): string {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 5)).toISOString().slice(0, 10)
}

export function NuevoAcuerdo({ jugadores }: { jugadores: JugadorDeuda[] }) {
  const [open, setOpen] = useState(false)
  const [jugadorId, setJugadorId] = useState("")
  const [obligacionId, setObligacionId] = useState("")
  const [cuotas, setCuotas] = useState<Array<{ fecha: string; monto: string }>>([{ fecha: siguienteMes(1), monto: "" }])
  const [notas, setNotas] = useState("")

  const jugador = jugadores.find((j) => j.id === jugadorId)
  const deuda = jugador?.obligaciones.find((o) => o.id === obligacionId)
  const suma = cuotas.reduce((s, c) => s + (Number(c.monto.replace(/[^\d]/g, "")) || 0), 0)

  const cerrar = () => {
    setOpen(false)
    setJugadorId("")
    setObligacionId("")
    setCuotas([{ fecha: siguienteMes(1), monto: "" }])
    setNotas("")
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : cerrar())}>
      <DialogTrigger asChild>
        <Button className="bg-raza text-white hover:bg-raza/90">
          <Plus /> Nuevo acuerdo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo acuerdo de pago</DialogTitle>
          <DialogDescription>Queda registrado con fechas y montos. El jugador lo verá en su estado de cuenta.</DialogDescription>
        </DialogHeader>
        <ActionForm action={crearAcuerdoAction} onSuccess={cerrar} className="space-y-4">
          {(pending) => (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="jugador">Jugador</Label>
                <NativeSelect
                  id="jugador"
                  value={jugadorId}
                  onChange={(e) => {
                    setJugadorId(e.target.value)
                    setObligacionId("")
                  }}
                  required
                >
                  <option value="">Elige…</option>
                  {jugadores.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.nombre}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              {jugador ? (
                <div className="space-y-1.5">
                  <Label htmlFor="obligacion_id">Deuda que cubre</Label>
                  <NativeSelect id="obligacion_id" name="obligacion_id" value={obligacionId} onChange={(e) => setObligacionId(e.target.value)} required>
                    <option value="">Elige…</option>
                    {jugador.obligaciones.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.evento} · debe {formatCOP(o.saldo)} (vence {formatFecha(o.fecha_limite, true)})
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              ) : null}
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Cuotas pactadas</legend>
                {cuotas.map((c, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`fecha-${i + 1}`}>Fecha</Label>
                      <Input
                        id={`fecha-${i + 1}`}
                        name={`fecha:${i + 1}`}
                        type="date"
                        required
                        value={c.fecha}
                        onChange={(e) => setCuotas((cs) => cs.map((x, j) => (j === i ? { ...x, fecha: e.target.value } : x)))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`monto-${i + 1}`}>Monto</Label>
                      <Input
                        id={`monto-${i + 1}`}
                        name={`monto:${i + 1}`}
                        inputMode="numeric"
                        required
                        placeholder="60000"
                        value={c.monto}
                        onChange={(e) => setCuotas((cs) => cs.map((x, j) => (j === i ? { ...x, monto: e.target.value } : x)))}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={cuotas.length <= 1}
                      onClick={() => setCuotas((cs) => cs.filter((_, j) => j !== i))}
                      aria-label={`Quitar cuota ${i + 1}`}
                    >
                      <X />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2">
                  <Button type="button" variant="outline" onClick={() => setCuotas((cs) => [...cs, { fecha: siguienteMes(cs.length + 1), monto: "" }])}>
                    Agregar cuota
                  </Button>
                  <p className="text-[13px] text-muted-foreground tabular-nums">Suman {formatCOP(suma)}</p>
                </div>
                {deuda && suma > 0 && suma !== deuda.saldo ? (
                  <p className="text-[13px] text-warn">
                    Las cuotas suman {formatCOP(suma)} y la deuda es {formatCOP(deuda.saldo)}. Verifica que sea lo pactado.
                  </p>
                ) : null}
              </fieldset>
              <div className="space-y-1.5">
                <Label htmlFor="notas">Notas (opcional)</Label>
                <Textarea id="notas" name="notas" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Lo que se pactó con el jugador" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="evidencia">Evidencia del acuerdo</Label>
                <Input id="evidencia" name="evidencia" type="file" required accept="image/*,application/pdf" />
                <p className="text-[13px] text-muted-foreground">Captura del mensaje o documento donde el jugador acepta las condiciones.</p>
              </div>
              <Button type="submit" disabled={pending || !obligacionId} className="w-full">
                {pending ? "Registrando…" : "Registrar acuerdo"}
              </Button>
            </>
          )}
        </ActionForm>
      </DialogContent>
    </Dialog>
  )
}
