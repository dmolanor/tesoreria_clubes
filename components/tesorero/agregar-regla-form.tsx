"use client"

import { ActionForm } from "@/components/action-form"
import { NativeSelect } from "@/components/native-select"
import { Button } from "@/components/ui/button"
import { agregarReglaEventoAction } from "@/app/actions/reglas"

export function AgregarReglaForm({ eventos }: { eventos: Array<{ id: string; nombre: string }> }) {
  return (
    <ActionForm action={agregarReglaEventoAction} className="flex flex-col gap-2 sm:flex-row">
      {(pending) => (
        <>
          <NativeSelect name="evento_cobro_id" required aria-label="Cobro a priorizar" className="sm:max-w-sm">
            {eventos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" disabled={pending || eventos.length === 0}>
            Agregar regla
          </Button>
        </>
      )}
    </ActionForm>
  )
}
