import { createClient } from "@/lib/supabase/server"
import { salir } from "@/app/actions/session"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function SinAcceso() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const correo = (data?.claims?.email as string | undefined) ?? "tu correo"
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Aún no tienes acceso</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            <strong>{correo}</strong> no está registrado en ningún club. Pídele al administrador que te agregue con este correo;
            después solo tienes que volver a entrar.
          </p>
          <form action={salir}>
            <Button type="submit" variant="outline">
              Entrar con otro correo
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
