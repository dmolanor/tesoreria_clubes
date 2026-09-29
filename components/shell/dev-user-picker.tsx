"use client"

import { useRef } from "react"
import { actuarComo } from "@/app/actions/session"

export interface DevUser {
  id: string
  nombre: string
  etiqueta: string
}

/** Solo modo dev: reemplaza el login para probar como cualquier persona del club. */
export function DevUserPicker({ users, currentId }: { users: { destacados: DevUser[]; resto: DevUser[] }; currentId: string }) {
  const form = useRef<HTMLFormElement>(null)
  return (
    <form ref={form} action={actuarComo} className="flex items-center gap-2">
      <label htmlFor="dev-user" className="label-caps hidden sm:inline">
        Actuar como
      </label>
      <select
        id="dev-user"
        name="usuario_id"
        defaultValue={currentId}
        onChange={() => form.current?.requestSubmit()}
        className="h-9 max-w-44 rounded-lg border border-dashed border-faint bg-card px-2 text-[13px] focus-visible:ring-2 focus-visible:ring-raza focus-visible:outline-none"
      >
        <optgroup label="Roles especiales">
          {users.destacados.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre} — {u.etiqueta}
            </option>
          ))}
        </optgroup>
        <optgroup label="Jugadores">
          {users.resto.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre} — {u.etiqueta}
            </option>
          ))}
        </optgroup>
      </select>
    </form>
  )
}
