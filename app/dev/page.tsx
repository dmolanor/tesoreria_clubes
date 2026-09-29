import { notFound } from "next/navigation"
import { getStore } from "@/lib/data"
import { AUTH_MODE } from "@/lib/auth/session"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DevReset } from "@/components/dev-reset"

export default async function DevPage() {
  if (AUTH_MODE !== "dev") notFound()
  const db = await getStore().read()
  const pendientes = db.comprobantes.filter((c) => c.estado === "pendiente").length
  return (
    <Card>
      <CardHeader>
        <CardTitle>Herramientas de prototipo</CardTitle>
        <CardDescription>Solo existe mientras no hay login real (AUTH_MODE=dev).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p>
          Datos actuales: {db.usuarios.length} usuarios, {db.eventos_cobro.length} eventos, {db.obligaciones.length} obligaciones,{" "}
          {db.comprobantes.length} comprobantes ({pendientes} pendientes), {db.bitacora.length} entradas de bitácora.
        </p>
        <p className="text-muted-foreground">
          Usa el selector “Actuar como” de la barra superior para cambiar de persona. Laura Gómez es tesorera y jugadora; Diego Rincón es
          administrador y jugador; Andrés Molina es solo administrador.
        </p>
        <DevReset />
      </CardContent>
    </Card>
  )
}
