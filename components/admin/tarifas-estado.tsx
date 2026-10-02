"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ActionForm } from "@/components/action-form"
import { guardarTarifasAction } from "@/app/actions/tarifas"

/** Tarjeta compacta: cuánto paga un jugador lesionado o inactivo en vez de la mensualidad completa. */
export function TarifasEstado({ lesionado, inactivo }: { lesionado: number | null; inactivo: number | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tarifas por estado</CardTitle>
        <CardDescription>
          Un jugador lesionado o inactivo paga este monto fijo en vez de la mensualidad. Al cambiar de estado, el mes se cobra proporcional a los días que falten.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ActionForm action={guardarTarifasAction} className="flex flex-wrap items-end gap-4">
          {(pending) => (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="tarifa-lesionado">Lesionado</Label>
                <Input id="tarifa-lesionado" name="lesionado" inputMode="numeric" defaultValue={lesionado ?? ""} placeholder="0" className="w-32" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tarifa-inactivo">Inactivo</Label>
                <Input id="tarifa-inactivo" name="inactivo" inputMode="numeric" defaultValue={inactivo ?? ""} placeholder="0" className="w-32" />
              </div>
              <Button type="submit" disabled={pending} variant="outline">
                {pending ? "Guardando…" : "Guardar"}
              </Button>
            </>
          )}
        </ActionForm>
      </CardContent>
    </Card>
  )
}
