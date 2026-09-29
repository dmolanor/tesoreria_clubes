"use client"

import { useTransition } from "react"
import { cambiarRol } from "@/app/actions/session"
import type { Rol } from "@/lib/data/types"
import { cn } from "@/lib/utils"

const LABEL: Record<Rol, string> = { jugador: "Jugador", tesorero: "Tesorero", administrativo: "Admin" }

/** Segmented control: solo aparece si la persona tiene más de un rol activo. */
export function RoleSwitcher({ roles, activo }: { roles: Rol[]; activo: Rol }) {
  const [pending, start] = useTransition()
  if (roles.length < 2) return null
  return (
    <div role="tablist" aria-label="Rol" className={cn("inline-flex rounded-lg border border-border bg-muted p-0.5", pending && "opacity-60")}>
      {roles.map((rol) => (
        <button
          key={rol}
          role="tab"
          aria-selected={rol === activo}
          disabled={pending}
          onClick={() => rol !== activo && start(() => cambiarRol(rol))}
          className={cn(
            "h-9 rounded-md px-3 text-[13px] font-medium text-muted-foreground transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-raza focus-visible:outline-none sm:h-8",
            rol === activo && "bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
          )}
        >
          {LABEL[rol]}
        </button>
      ))}
    </div>
  )
}
