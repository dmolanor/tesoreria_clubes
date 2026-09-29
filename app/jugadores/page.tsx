import Link from "next/link"
import { getStore } from "@/lib/data"
import { pageSession } from "@/lib/auth/page"
import { estadoCuenta, jugadoresDelClub } from "@/lib/domain/ledger"
import { formatCOP, hoyISO } from "@/lib/format"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusDot } from "@/components/status-dot"
import { EstadoSelect } from "@/components/admin/estado-select"
import { ImportarJugadores } from "@/components/admin/importar-jugadores"
import { ActivityPanel } from "@/components/activity-panel"
import { cn } from "@/lib/utils"

export default async function JugadoresPage(props: PageProps<"/jugadores">) {
  const s = await pageSession("administrativo")
  const { categoria } = await props.searchParams
  const db = await getStore().read()
  const hoy = hoyISO()
  const todos = jugadoresDelClub(db, s.club_id).sort((a, b) => a.nombre.localeCompare(b.nombre))
  const lista = categoria === "Élite" || categoria === "Junior" ? todos.filter((u) => u.categoria === categoria) : todos
  const cuenta = (cat: string, estado: string) => todos.filter((u) => u.categoria === cat && u.estado === estado).length

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Jugadores</CardTitle>
          <CardDescription>
            Élite: {cuenta("Élite", "activo")} activos, {cuenta("Élite", "lesionado")} lesionados · Junior: {cuenta("Junior", "activo")} activos,{" "}
            {cuenta("Junior", "lesionado")} lesionados · {todos.filter((u) => u.estado === "retirado").length} retirados
          </CardDescription>
          <CardAction>
            <ImportarJugadores />
          </CardAction>
          <div className="flex gap-1 pt-2">
            {["Todos", "Élite", "Junior"].map((c) => {
              const activo = (categoria ?? "Todos") === c
              return (
                <Link
                  key={c}
                  href={c === "Todos" ? "/jugadores" : `/jugadores?categoria=${c}`}
                  className={cn("rounded-md px-3 py-1.5 text-[13px] font-medium", activo ? "bg-ink text-paper" : "bg-muted text-muted-foreground hover:text-foreground")}
                >
                  {c}
                </Link>
              )
            })}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead className="text-right">Debe</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((u) => {
                const c = estadoCuenta(db, u.id, hoy)
                return (
                  <TableRow key={u.id} className={u.estado === "retirado" ? "text-muted-foreground" : undefined}>
                    <TableCell>
                      <Link href={`/jugadores/${u.id}`} className="font-medium hover:underline">
                        {u.nombre}
                      </Link>
                      <span className="block text-[13px] text-muted-foreground">{u.correo}</span>
                    </TableCell>
                    <TableCell>{u.categoria ?? "—"}</TableCell>
                    <TableCell>
                      <StatusDot estado={c.estado} label />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.totalPendiente ? formatCOP(c.totalPendiente) : "—"}</TableCell>
                    <TableCell>
                      <EstadoSelect key={`${u.id}-${u.estado}`} usuarioId={u.id} estado={u.estado} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <ActivityPanel tipos={["jugador_creado", "jugador_estado_cambiado"]} />
    </div>
  )
}
