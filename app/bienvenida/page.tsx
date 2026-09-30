import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CompletarRegistroForm } from "@/components/auth/completar-registro-form"

// Destino del enlace de invitación (/auth/confirm?type=invite). Si ya tiene los datos, sigue a su inicio.
export default async function Bienvenida() {
  const s = await getSession()
  if (s.usuario.telefono) redirect("/")
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div>
        <p className="text-[24px] font-bold">{s.clubNombre}</p>
        <p className="text-muted-foreground">Tesorería del club</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Completa tus datos</CardTitle>
          <CardDescription>Revisa tu nombre y deja tu celular para que la tesorería pueda contactarte sobre cobros y pagos.</CardDescription>
        </CardHeader>
        <CardContent>
          <CompletarRegistroForm nombre={s.usuario.nombre} />
        </CardContent>
      </Card>
    </main>
  )
}
