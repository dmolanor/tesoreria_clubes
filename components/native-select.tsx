import * as React from "react"
import { cn } from "@/lib/utils"

/** Select nativo: se envía en formularios sin JS y es el más cómodo en el celular. */
export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-11 sm:h-9 w-full rounded-lg border border-input bg-card px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-raza",
        className,
      )}
      {...props}
    />
  )
}
