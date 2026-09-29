"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { setRolAction } from "@/app/actions/jugadores"
import type { Rol } from "@/lib/data/types"

const ROLES: Array<{ rol: Rol; label: string }> = [
  { rol: "jugador", label: "Jugador" },
  { rol: "tesorero", label: "Tesorero" },
  { rol: "administrativo", label: "Administrador" },
]

/** Multi-rol real: una persona puede tener varios roles a la vez. */
export function RolesEditor({ usuarioId, activos }: { usuarioId: string; activos: Rol[] }) {
  const [pending, start] = useTransition()
  return (
    <fieldset disabled={pending} className="flex flex-wrap gap-2">
      <legend className="sr-only">Roles</legend>
      {ROLES.map(({ rol, label }) => (
        <label key={rol} className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 has-checked:border-ink has-checked:font-medium">
          <input
            type="checkbox"
            className="size-4 accent-(--raza)"
            defaultChecked={activos.includes(rol)}
            onChange={(e) =>
              start(async () => {
                const r = await setRolAction(usuarioId, rol, e.target.checked)
                if (r && !r.ok) {
                  toast.error(r.error)
                  e.target.checked = !e.target.checked
                } else toast.success(`Rol ${label.toLowerCase()} ${e.target.checked ? "asignado" : "quitado"}`)
              })
            }
          />
          {label}
        </label>
      ))}
    </fieldset>
  )
}
