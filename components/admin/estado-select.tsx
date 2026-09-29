"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { NativeSelect } from "@/components/native-select"
import { cambiarEstadoAction } from "@/app/actions/jugadores"
import type { EstadoJugador } from "@/lib/data/types"

export function EstadoSelect({ usuarioId, estado }: { usuarioId: string; estado: EstadoJugador }) {
  const [pending, start] = useTransition()
  return (
    <NativeSelect
      aria-label="Estado del jugador"
      defaultValue={estado}
      disabled={pending}
      className="h-9 w-32"
      onChange={(e) => {
        const nuevo = e.target.value as EstadoJugador
        start(async () => {
          const r = await cambiarEstadoAction(usuarioId, nuevo)
          if (r && !r.ok) toast.error(r.error)
          else if (r?.message) toast.success(r.message)
        })
      }}
    >
      <option value="activo">Activo</option>
      <option value="lesionado">Lesionado</option>
      <option value="retirado">Retirado</option>
    </NativeSelect>
  )
}
