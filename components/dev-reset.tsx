"use client"

import { ActionButton } from "@/components/action-button"
import { reiniciarDemoAction } from "@/app/actions/dev"

export function DevReset() {
  return (
    <ActionButton variant="outline" confirm="Confirmar: se pierde todo lo hecho" action={reiniciarDemoAction}>
      Reiniciar datos demo
    </ActionButton>
  )
}
