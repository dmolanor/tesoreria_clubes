"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/native-select"
import { ActionForm } from "@/components/action-form"
import { registrarEgresoAction } from "@/app/actions/egresos"
import { CATEGORIA_EGRESO_LABEL, type CategoriaEgreso } from "@/lib/db/types"

/** Registro corto de un egreso dentro de la conciliación; la fecha se limita al mes que se está cuadrando. */
export function EgresoForm({ min, max }: { min: string; max: string }) {
  return (
    <ActionForm action={registrarEgresoAction} resetOnSuccess className="space-y-3" key={min}>
      {(pending) => (
        <>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr]">
            <div className="space-y-1.5">
              <Label htmlFor="egreso_fecha">Fecha</Label>
              <Input id="egreso_fecha" name="fecha" type="date" required defaultValue={max} min={min} max={max} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="egreso_monto">Monto (COP)</Label>
              <Input id="egreso_monto" name="monto" inputMode="numeric" required placeholder="1200000" autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="egreso_concepto">Concepto</Label>
              <Input id="egreso_concepto" name="concepto" required maxLength={200} placeholder="Arriendo cancha sábados" autoComplete="off" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="egreso_categoria">Categoría</Label>
              <NativeSelect id="egreso_categoria" name="categoria" defaultValue="arriendo_cancha">
                {(Object.keys(CATEGORIA_EGRESO_LABEL) as CategoriaEgreso[]).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORIA_EGRESO_LABEL[c]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="egreso_soporte">Factura o recibo (opcional)</Label>
              <Input id="egreso_soporte" name="soporte" type="file" accept="image/*,application/pdf" />
            </div>
          </div>
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? "Registrando…" : "Registrar egreso"}
          </Button>
        </>
      )}
    </ActionForm>
  )
}
