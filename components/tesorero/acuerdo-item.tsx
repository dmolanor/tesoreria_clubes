"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ActionForm } from "@/components/action-form"
import { ActionButton } from "@/components/action-button"
import { StatusDot } from "@/components/status-dot"
import { ajustarCuotasAction, cancelarAcuerdoAction } from "@/app/actions/acuerdos"
import { estadoCuotas } from "@/lib/acuerdos"
import type { AcuerdoVista } from "@/lib/db/acuerdos"
import { formatCOP, formatFecha } from "@/lib/format"
import { cn } from "@/lib/utils"

export function CuotasTabla({ pagado, cuotas }: { pagado: number; cuotas: AcuerdoVista["cuotas"] }) {
  const filas = estadoCuotas(pagado, cuotas)
  return (
    <ul className="divide-y divide-border">
      {filas.map((c) => (
        <li key={c.numero} className="flex items-baseline justify-between gap-3 py-1.5 text-[14px]">
          <span className="flex items-center gap-2">
            <StatusDot estado={c.cubierta ? "al_dia" : "pendiente"} />
            Cuota {c.numero} · {formatFecha(c.fecha)}
          </span>
          <span className={cn("tabular-nums", c.cubierta && "text-muted-foreground")}>{formatCOP(c.monto)}</span>
        </li>
      ))}
    </ul>
  )
}

export function AcuerdoItem({ acuerdo }: { acuerdo: AcuerdoVista }) {
  const [open, setOpen] = useState(false)
  const [cuotas, setCuotas] = useState(() => acuerdo.cuotas.map((c) => ({ fecha: c.fecha, monto: String(c.monto) })))
  const total = acuerdo.cuotas.reduce((s, c) => s + c.monto, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Link href={`/jugadores/${acuerdo.miembro_id}`} className="hover:underline">
            {acuerdo.miembro}
          </Link>{" "}
          <span className="text-[13px] font-medium text-muted-foreground">· {acuerdo.evento}</span>
        </CardTitle>
        <p className="text-[13px] text-muted-foreground">
          {formatCOP(total)} en {acuerdo.cuotas.length} {acuerdo.cuotas.length === 1 ? "cuota" : "cuotas"} · van {formatCOP(acuerdo.pagado_deuda)} de{" "}
          {formatCOP(acuerdo.monto_deuda)}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <CuotasTabla pagado={acuerdo.pagado_deuda} cuotas={acuerdo.cuotas} />
        {acuerdo.notas ? <p className="text-[13px] text-muted-foreground">{acuerdo.notas}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o)
              if (o) setCuotas(acuerdo.cuotas.map((c) => ({ fecha: c.fecha, monto: String(c.monto) })))
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline">Ajustar cuotas</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Ajustar cuotas</DialogTitle>
              </DialogHeader>
              <ActionForm action={ajustarCuotasAction} onSuccess={() => setOpen(false)} className="space-y-3">
                {(pending) => (
                  <>
                    <input type="hidden" name="acuerdo_id" value={acuerdo.id} />
                    {cuotas.map((c, i) => (
                      <div key={i} className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <Label htmlFor={`a-fecha-${i}`}>Fecha</Label>
                          <Input
                            id={`a-fecha-${i}`}
                            name={`fecha:${i + 1}`}
                            type="date"
                            required
                            value={c.fecha}
                            onChange={(e) => setCuotas((cs) => cs.map((x, j) => (j === i ? { ...x, fecha: e.target.value } : x)))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`a-monto-${i}`}>Monto</Label>
                          <Input
                            id={`a-monto-${i}`}
                            name={`monto:${i + 1}`}
                            inputMode="numeric"
                            required
                            value={c.monto}
                            onChange={(e) => setCuotas((cs) => cs.map((x, j) => (j === i ? { ...x, monto: e.target.value } : x)))}
                          />
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCuotas((cs) => [...cs, { fecha: cs[cs.length - 1]?.fecha ?? "", monto: "" }])}
                      >
                        Agregar cuota
                      </Button>
                      {cuotas.length > 1 ? (
                        <Button type="button" variant="ghost" onClick={() => setCuotas((cs) => cs.slice(0, -1))}>
                          Quitar última
                        </Button>
                      ) : null}
                    </div>
                    <Button type="submit" disabled={pending} className="w-full">
                      {pending ? "Guardando…" : "Guardar cuotas"}
                    </Button>
                  </>
                )}
              </ActionForm>
            </DialogContent>
          </Dialog>
          <ActionButton variant="ghost" confirm="Confirmar cancelación" action={cancelarAcuerdoAction.bind(null, acuerdo.id)}>
            Cancelar acuerdo
          </ActionButton>
        </div>
      </CardContent>
    </Card>
  )
}
