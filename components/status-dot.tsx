import { cn } from "@/lib/utils"
import type { EstadoCuenta } from "@/lib/db/types"

// Lenguaje de DESIGN.md: forma + un acento. Relleno teal = al día,
// contorno punteado = pendiente/atención, relleno ámbar = mora, vacío = inactivo.
const ESTILOS: Record<EstadoCuenta | "inactivo", string> = {
  al_dia: "bg-raza border-raza",
  pendiente: "border-ink border-dashed bg-transparent",
  mora: "bg-warn border-warn",
  inactivo: "border-faint bg-transparent",
}

export const ESTADO_LABEL: Record<EstadoCuenta | "inactivo", string> = {
  al_dia: "Al día",
  pendiente: "Pendiente",
  mora: "En mora",
  inactivo: "Inactivo",
}

export function StatusDot({ estado, label = false, className }: { estado: EstadoCuenta | "inactivo"; label?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span aria-hidden className={cn("inline-block size-2.5 shrink-0 rounded-full border-[1.5px]", ESTILOS[estado])} />
      {label ? <span className={cn("text-[13px] font-medium", estado === "mora" && "text-warn")}>{ESTADO_LABEL[estado]}</span> : <span className="sr-only">{ESTADO_LABEL[estado]}</span>}
    </span>
  )
}
