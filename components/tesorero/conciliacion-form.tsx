"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { ActionForm } from "@/components/action-form"
import { guardarConciliacionAction } from "@/app/actions/conciliacion"
import { formatCOP } from "@/lib/format"
import { cuadreMes } from "@/lib/cuadre"
import { cn } from "@/lib/utils"

const num = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0

/** Saldos del extracto vs. ingresos − egresos registrados en la plataforma; la diferencia se ve en vivo. */
export function ConciliacionForm(props: {
  mes: string
  totalAceptado: number
  totalEgresos: number
  saldoInicial: number
  saldoFinal: number | null
  notas: string | null
}) {
  const [inicial, setInicial] = useState(String(props.saldoInicial || ""))
  const [final, setFinal] = useState(props.saldoFinal == null ? "" : String(props.saldoFinal))
  const cuadre = cuadreMes({
    ingresos: props.totalAceptado,
    egresos: props.totalEgresos,
    saldoInicial: num(inicial),
    saldoFinal: final ? num(final) : null,
  })

  return (
    <ActionForm action={guardarConciliacionAction} className="space-y-4" key={props.mes}>
      {(pending) => (
        <>
          <input type="hidden" name="mes" value={props.mes} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="saldo_inicial">Saldo inicial del banco</Label>
              <Input id="saldo_inicial" name="saldo_inicial" inputMode="numeric" value={inicial} onChange={(e) => setInicial(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="saldo_final">Saldo final del banco</Label>
              <Input id="saldo_final" name="saldo_final" inputMode="numeric" value={final} onChange={(e) => setFinal(e.target.value)} required />
            </div>
          </div>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-lg bg-muted p-3 tabular-nums">
            <dt>Ingresos (comprobantes aceptados)</dt>
            <dd className="text-right">{formatCOP(cuadre.ingresos)}</dd>
            <dt>Egresos registrados</dt>
            <dd className="text-right">{formatCOP(cuadre.egresos ? -cuadre.egresos : 0)}</dd>
            <dt className="font-medium">Neto esperado (ingresos − egresos)</dt>
            <dd className="text-right font-medium">{formatCOP(cuadre.esperado)}</dd>
            <dt>Movimiento del banco (final − inicial)</dt>
            <dd className="text-right">{cuadre.banco == null ? "—" : formatCOP(cuadre.banco)}</dd>
            <dt className="font-bold">Diferencia</dt>
            <dd className={cn("text-right font-bold", cuadre.diferencia != null && cuadre.diferencia !== 0 && "text-warn", cuadre.diferencia === 0 && "text-raza")}>
              {cuadre.diferencia == null ? "—" : formatCOP(cuadre.diferencia)}
            </dd>
          </dl>
          <div className="space-y-1.5">
            <Label htmlFor="notas">Notas</Label>
            <Textarea id="notas" name="notas" rows={2} defaultValue={props.notas ?? ""} placeholder="Ej: $15.000 de comisión bancaria" />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar conciliación"}
          </Button>
        </>
      )}
    </ActionForm>
  )
}
