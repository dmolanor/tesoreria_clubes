import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { DEMO_MODE } from "@/lib/auth/session"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DemoLoginForm, MagicLinkForm, type CuentaDemo } from "@/components/auth/login-forms"

const ROL_CORTO = { tesorero: "tesorero", administrativo: "admin", jugador: "jugador" } as const

async function cuentasDemo(): Promise<CuentaDemo[]> {
  const { data } = await createAdminClient()
    .from("miembros")
    .select("correo, nombre, categoria, roles")
    .like("correo", "%@example.com")
    .neq("estado", "retirado")
    .order("nombre")
  const filas = (data ?? []).map((m) => ({
    correo: m.correo,
    nombre: m.nombre,
    etiqueta: m.roles.some((r) => r !== "jugador") ? m.roles.map((r) => ROL_CORTO[r]).join(" + ") : (m.categoria ?? "jugador"),
    especial: m.roles.some((r) => r !== "jugador"),
  }))
  // Primero las cuentas con roles especiales (tesorera, admin), luego jugadores.
  return [...filas.filter((f) => f.especial), ...filas.filter((f) => !f.especial)]
}

export default async function LoginPage(props: PageProps<"/login">) {
  const { error } = await props.searchParams
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (data?.claims) redirect("/")

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div>
        <p className="text-[24px] font-bold">Raza Ultimate</p>
        <p className="text-muted-foreground">Tesorería del club</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Entrar</CardTitle>
          <CardDescription>Te enviamos un enlace a tu correo, sin contraseñas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error === "enlace" ? (
            <p role="alert" className="text-[13px] font-medium text-warn">
              El enlace ya se usó o venció. Pide uno nuevo.
            </p>
          ) : null}
          <MagicLinkForm />
        </CardContent>
      </Card>
      {DEMO_MODE ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Modo demo</CardTitle>
            <CardDescription>Para probar los roles con datos de ejemplo. Pide la clave demo a quien te compartió el enlace.</CardDescription>
          </CardHeader>
          <CardContent>
            <DemoLoginForm cuentas={await cuentasDemo()} />
          </CardContent>
        </Card>
      ) : null}
    </main>
  )
}
