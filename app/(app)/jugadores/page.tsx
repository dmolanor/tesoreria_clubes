import Link from "next/link"
import { pageSession } from "@/lib/auth/page"
import { categoriasDelClub, jugadoresDelClub } from "@/lib/db/admin"
import { estadosDeCuenta } from "@/lib/db/cuenta"
import { formatCOP } from "@/lib/format"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table"
import { StatusDot } from "@/components/status-dot"
import { CategoriaTag } from "@/components/categoria-tag"
import { EstadoSelect } from "@/components/admin/estado-select"
import { ImportarJugadores } from "@/components/admin/importar-jugadores"
import { ActivityPanel } from "@/components/activity-panel"
import { SortableHead } from "@/components/sortable-head"
import { parseSort, sortRows, type SortColumns } from "@/lib/sort"
import type { Cuenta } from "@/lib/db/cuenta"
import type { EstadoMiembro, Miembro } from "@/lib/db/types"
import { cn } from "@/lib/utils"

interface Fila {
  u: Miembro
  c: Cuenta | undefined
}

const RANGO_CUENTA = { al_dia: 0, pendiente: 1, mora: 2 } as const
const RANGO_ESTADO: Record<EstadoMiembro, number> = { activo: 0, lesionado: 1, inactivo: 2, retirado: 3 }

/** Saldo con signo: positivo = debe, negativo = saldo a favor. De mayor a menor agrupa la mayor deuda arriba. */
const saldo = (c: Cuenta | undefined) => (c ? c.total_pendiente - c.saldo_a_favor : 0)

const COLUMNAS: SortColumns<Fila> = {
  nombre: { kind: "text", value: (f) => f.u.nombre },
  categoria: { kind: "text", value: (f) => f.u.categoria },
  cuenta: {
    kind: "number",
    value: (f) => RANGO_CUENTA[f.c?.estado ?? "al_dia"],
    dirText: { desc: "con los jugadores en mora primero", asc: "con los jugadores al día primero" },
  },
  saldo: {
    kind: "number",
    value: (f) => saldo(f.c),
    dirText: { desc: "de mayor a menor deuda", asc: "con el mayor saldo a favor primero" },
  },
  estado: {
    kind: "number",
    value: (f) => RANGO_ESTADO[f.u.estado],
    firstDir: "asc",
    dirText: { asc: "activos, lesionados, inactivos y retirados", desc: "retirados, inactivos, lesionados y activos" },
  },
}

export default async function JugadoresPage(props: PageProps<"/jugadores">) {
  const s = await pageSession("administrativo")
  const sb = s.supabase
  const searchParams = await props.searchParams
  const { categoria } = searchParams
  const [todos, categorias, cuentas] = await Promise.all([
    jugadoresDelClub(sb, s.club_id),
    categoriasDelClub(sb, s.club_id),
    estadosDeCuenta(sb, s.club_id),
  ])
  const filtro = typeof categoria === "string" && categorias.includes(categoria) ? categoria : null
  const lista = filtro ? todos.filter((u) => u.categoria === filtro) : todos
  const orden = parseSort(searchParams, COLUMNAS)
  const filas = sortRows(
    lista.map((u) => ({ u, c: cuentas.get(u.id) })),
    COLUMNAS,
    orden,
  )
  const conOrden = (p: { categoria?: string }) => {
    const qs = new URLSearchParams(p)
    if (orden) {
      qs.set("orden", orden.col)
      qs.set("dir", orden.dir)
    }
    const q = qs.toString()
    return q ? `/jugadores?${q}` : "/jugadores"
  }
  const head = (col: keyof typeof COLUMNAS & string, label: string, align?: "right") => (
    <SortableHead col={col} label={label} column={COLUMNAS[col]} sort={orden} pathname="/jugadores" params={{ categoria: filtro ?? undefined }} align={align} />
  )
  const cuenta = (cat: string, estado: string) => todos.filter((u) => u.categoria === cat && u.estado === estado).length

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Jugadores</CardTitle>
          <CardDescription>
            {categorias.map((c) => `${c}: ${cuenta(c, "activo")} activos, ${cuenta(c, "lesionado")} lesionados, ${cuenta(c, "inactivo")} inactivos`).join(" · ")} ·{" "}
            {todos.filter((u) => u.estado === "retirado").length} retirados
          </CardDescription>
          <CardAction>
            <ImportarJugadores />
          </CardAction>
          <div className="flex gap-1 pt-2">
            {["Todos", ...categorias].map((c) => {
              const activo = (filtro ?? "Todos") === c
              return (
                <Link
                  key={c}
                  href={conOrden(c === "Todos" ? {} : { categoria: c })}
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
                {head("nombre", "Nombre")}
                {head("categoria", "Categoría")}
                {head("cuenta", "Cuenta")}
                {head("saldo", "Saldo", "right")}
                {head("estado", "Estado")}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map(({ u, c }) => (
                <TableRow key={u.id} className={u.estado === "retirado" ? "text-muted-foreground" : undefined}>
                  <TableCell>
                    <Link href={`/jugadores/${u.id}`} className="font-medium hover:underline">
                      {u.nombre}
                    </Link>
                    <span className="block text-[13px] text-muted-foreground">
                      {u.correo}
                      {u.auth_user_id ? "" : " · aún no ha entrado"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <CategoriaTag categoria={u.categoria} />
                  </TableCell>
                  <TableCell>
                    <StatusDot estado={c?.estado ?? "al_dia"} label />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c?.total_pendiente ? formatCOP(c.total_pendiente) : c?.saldo_a_favor ? null : "—"}
                    {c?.saldo_a_favor ? <span className="block text-[13px] text-muted-foreground">{formatCOP(c.saldo_a_favor)} a favor</span> : null}
                  </TableCell>
                  <TableCell>
                    <EstadoSelect key={`${u.id}-${u.estado}`} usuarioId={u.id} estado={u.estado} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <ActivityPanel tipos={["jugador_creado", "jugador_estado_cambiado"]} />
    </div>
  )
}
