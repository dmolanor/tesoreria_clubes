import Link from "next/link"
import { getStore } from "@/lib/data"
import { pageSession } from "@/lib/auth/page"
import { formatFecha, hoyISO, diasEntre } from "@/lib/format"
import { jugadoresEnMora } from "@/lib/mora"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

// Solo nombres, sin montos (decisión del club: la lista se comparte con el grupo).
export default async function MoraPage() {
  const s = await pageSession("tesorero")
  const db = await getStore().read()
  const hoy = hoyISO()
  const mora = jugadoresEnMora(db, s.club_id, hoy)
  const porCategoria = (cat: string) => mora.filter((m) => m.u.categoria === cat)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jugadores en mora ({mora.length})</CardTitle>
        <CardDescription>Solo nombres, sin montos: esta lista es la que se comparte con el grupo.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2">
        {["Élite", "Junior"].map((cat) => (
          <div key={cat}>
            <h3 className="label-caps mb-2">
              {cat} · {porCategoria(cat).length}
            </h3>
            <ul className="space-y-1.5">
              {porCategoria(cat).map(({ u, desde, vencidas }) => (
                <li key={u.id} className="flex items-baseline justify-between gap-3">
                  <Link href={`/jugadores/${u.id}`} className="hover:underline">
                    {u.nombre}
                  </Link>
                  <span className="text-[13px] text-muted-foreground">
                    {vencidas.length} {vencidas.length === 1 ? "cobro" : "cobros"} · desde {formatFecha(desde!, true)} ({diasEntre(desde!, hoy)} días)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
