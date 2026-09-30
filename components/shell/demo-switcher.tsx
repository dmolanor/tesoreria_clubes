"use client"

import { useRef } from "react"
import { cambiarCuentaDemo } from "@/app/actions/session"

export interface DemoUser {
  id: string
  nombre: string
  etiqueta: string
}

/** Solo modo demo: cambia a otra cuenta demo (sesión real de Supabase, RLS aplica igual). */
export function DemoSwitcher({ users, currentId }: { users: { destacados: DemoUser[]; resto: DemoUser[] }; currentId: string }) {
  const form = useRef<HTMLFormElement>(null)
  return (
    <form ref={form} action={cambiarCuentaDemo} className="flex items-center gap-2">
      <label htmlFor="demo-user" className="label-caps hidden sm:inline">
        Demo
      </label>
      <select
        id="demo-user"
        name="miembro_id"
        defaultValue={currentId}
        onChange={() => form.current?.requestSubmit()}
        className="h-9 max-w-44 rounded-lg border border-dashed border-faint bg-card px-2 text-[13px] focus-visible:ring-2 focus-visible:ring-raza focus-visible:outline-none"
      >
        <optgroup label="Roles especiales">
          {users.destacados.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre} · {u.etiqueta}
            </option>
          ))}
        </optgroup>
        <optgroup label="Jugadores">
          {users.resto.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre} · {u.etiqueta}
            </option>
          ))}
        </optgroup>
      </select>
    </form>
  )
}
