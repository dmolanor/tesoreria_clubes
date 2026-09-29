"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { ActionResult } from "@/lib/action-result"

type Props = Omit<React.ComponentProps<typeof Button>, "onClick"> & {
  action: () => Promise<ActionResult>
  /** Si se da, el primer clic pide confirmación en el mismo botón (sin diálogo del navegador). */
  confirm?: string
}

/** Botón que ejecuta una server action y muestra el resultado como toast. */
export function ActionButton({ action, confirm, children, disabled, ...props }: Props) {
  const [pending, start] = useTransition()
  const [armed, setArmed] = useState(false)
  return (
    <Button
      {...props}
      variant={armed ? "destructive" : props.variant}
      disabled={disabled || pending}
      onBlur={() => setArmed(false)}
      onClick={() => {
        if (confirm && !armed) return setArmed(true)
        setArmed(false)
        start(async () => {
          const r = await action()
          if (r && !r.ok) toast.error(r.error)
          else if (r?.message) toast.success(r.message)
        })
      }}
    >
      {pending ? "…" : armed ? confirm : children}
    </Button>
  )
}
