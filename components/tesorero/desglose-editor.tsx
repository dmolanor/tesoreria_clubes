"use client"

import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ActionForm } from "@/components/action-form"
import { aceptarConDesgloseAction } from "@/app/actions/comprobantes"
import { formatCOP, formatFecha } from "@/lib/format"
import { cn } from "@/lib/utils"

export interface FilaDesglose {
  obligacion_id: string
  evento: string
  fecha_limite: string
  saldo: number
  propuesto: number
  regla: string | null
}

/** Propuesta del motor, editable línea por línea antes de aceptar. */
export function DesgloseEditor({ comprobanteId, monto, filas }: { comprobanteId: string; monto: number; filas: FilaDesglose[] }) {
  const inicial = useMemo(() => Object.fromEntries(filas.map((f) => [f.obligacion_id, f.propuesto])), [filas])
  const [valores, setValores] = useState<Record<string, number>>(inicial)
  const asignado = Object.values(valores).reduce((s, v) => s + (v || 0), 0)
  const sobrante = monto - asignado
  const excedidas = filas.filter((f) => (valores[f.obligacion_id] || 0) > f.saldo)
  const editado = filas.some((f) => (valores[f.obligacion_id] || 0) !== f.propuesto)
  const invalido = sobrante < 0 || excedidas.length > 0

  return (
    <ActionForm action={aceptarConDesgloseAction}>
      {(pending) => (
        <>
          <input type="hidden" name="comprobante_id" value={comprobanteId} />
          {filas.length === 0 ? <p className="text-muted-foreground">Como el jugador no tiene deudas pendientes, todo irá a saldo a favor.</p> : null}
          <ul className="divide-y divide-border">
            {filas.map((f) => {
              const v = valores[f.obligacion_id] || 0
              const cambiado = v !== f.propuesto
              return (
                <li key={f.obligacion_id} className="grid grid-cols-[1fr_130px] items-center gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-medium">{f.evento}</p>
                    <p className="text-[13px] text-muted-foreground">
                      Vence {formatFecha(f.fecha_limite, true)} · debe {formatCOP(f.saldo)}
                      {f.propuesto > 0 && !cambiado ? <span className="text-raza"> · {f.regla}</span> : null}
                      {cambiado ? <span className="text-warn"> · ajuste manual</span> : null}
                    </p>
                  </div>
                  <Input
                    name={`monto:${f.obligacion_id}`}
                    inputMode="numeric"
                    aria-label={`Monto para ${f.evento}`}
                    value={v ? String(v) : ""}
                    placeholder="0"
                    onChange={(e) => setValores((p) => ({ ...p, [f.obligacion_id]: Number(e.target.value.replace(/[^\d]/g, "")) }))}
                    className={cn("text-right tabular-nums", v > f.saldo && "border-warn")}
                  />
                </li>
              )
            })}
          </ul>
          <div className="mt-3 space-y-0.5 border-t border-border pt-3 text-[14px]">
            <p>
              Asignado <strong className="tabular-nums">{formatCOP(asignado)}</strong> de {formatCOP(monto)}
            </p>
            {sobrante > 0 ? <p>{formatCOP(sobrante)} quedan como saldo a favor del jugador</p> : null}
            {sobrante < 0 ? <p className="font-medium text-warn">Te pasaste por {formatCOP(-sobrante)}</p> : null}
            {excedidas.length ? <p className="font-medium text-warn">Hay líneas por encima de lo que se debe</p> : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="submit" disabled={pending || invalido} className="bg-raza text-white hover:bg-raza/90">
              {pending ? "Aceptando…" : editado ? "Aceptar con ajustes" : "Aceptar propuesta"}
            </Button>
            {editado ? (
              <Button type="button" variant="ghost" onClick={() => setValores(inicial)}>
                Volver a la propuesta
              </Button>
            ) : null}
          </div>
        </>
      )}
    </ActionForm>
  )
}
