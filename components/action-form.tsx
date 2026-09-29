"use client"

import { useActionState, useEffect, useRef } from "react"
import { toast } from "sonner"
import type { ActionResult } from "@/lib/action-result"

type Props = Omit<React.ComponentProps<"form">, "action" | "children"> & {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>
  onSuccess?: () => void
  resetOnSuccess?: boolean
  children: React.ReactNode | ((pending: boolean) => React.ReactNode)
}

/** Formulario ligado a una server action con feedback (toast + error en línea). */
export function ActionForm({ action, onSuccess, resetOnSuccess, children, ...props }: Props) {
  const [state, formAction, pending] = useActionState(action, null)
  const ref = useRef<HTMLFormElement>(null)
  const last = useRef<ActionResult>(null)

  useEffect(() => {
    if (!state || state === last.current) return
    last.current = state
    if (state.ok) {
      if (state.message) toast.success(state.message)
      if (resetOnSuccess) ref.current?.reset()
      onSuccess?.()
    } else {
      toast.error(state.error)
    }
  }, [state, onSuccess, resetOnSuccess])

  return (
    <form ref={ref} action={formAction} {...props}>
      {typeof children === "function" ? children(pending) : children}
      {state && !state.ok ? (
        <p role="alert" className="mt-2 text-[13px] font-medium text-warn">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
