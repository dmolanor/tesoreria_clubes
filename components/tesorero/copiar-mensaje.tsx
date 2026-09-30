"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Copia el mensaje al portapapeles para pegarlo en WhatsApp. */
export function CopiarMensaje({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <Button
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto)
          setCopiado(true)
          setTimeout(() => setCopiado(false), 2000)
        } catch {
          setCopiado(false)
        }
      }}
    >
      {copiado ? <Check /> : <Copy />}
      {copiado ? "Copiado" : "Copiar mensaje"}
    </Button>
  )
}
