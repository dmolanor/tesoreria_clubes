"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/native-select"
import { ActionForm } from "@/components/action-form"
import { entrarComoDemo, enviarEnlace } from "@/app/actions/session"

export function MagicLinkForm() {
  const [enviado, setEnviado] = useState(false)
  if (enviado) {
    return (
      <p className="rounded-lg border border-dashed border-border p-3">
        Revisa tu correo y abre el enlace para entrar. Puedes cerrar esta pestaña.
      </p>
    )
  }
  return (
    <ActionForm action={enviarEnlace} onSuccess={() => setEnviado(true)} className="space-y-3">
      {(pending) => (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="correo">Tu correo</Label>
            <Input id="correo" name="correo" type="email" autoComplete="email" required placeholder="nombre@correo.com" />
          </div>
          <Button type="submit" disabled={pending} className="w-full bg-raza text-white hover:bg-raza/90">
            {pending ? "Enviando…" : "Enviarme un enlace para entrar"}
          </Button>
        </>
      )}
    </ActionForm>
  )
}

export interface CuentaDemo {
  correo: string
  nombre: string
  etiqueta: string
}

export function DemoLoginForm({ cuentas }: { cuentas: CuentaDemo[] }) {
  return (
    <ActionForm action={entrarComoDemo} className="space-y-3">
      {(pending) => (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="demo-correo">Entrar como</Label>
            <NativeSelect id="demo-correo" name="correo" required>
              {cuentas.map((c) => (
                <option key={c.correo} value={c.correo}>
                  {c.nombre} — {c.etiqueta}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clave">Clave demo</Label>
            <Input id="clave" name="clave" type="password" required autoComplete="current-password" />
          </div>
          <Button type="submit" variant="outline" disabled={pending} className="w-full">
            {pending ? "Entrando…" : "Entrar a la demo"}
          </Button>
        </>
      )}
    </ActionForm>
  )
}
