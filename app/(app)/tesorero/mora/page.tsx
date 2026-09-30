import Link from "next/link"
import { pageSession } from "@/lib/auth/page"
import { enMora } from "@/lib/db/tesoreria"
import { categoriasDelClub } from "@/lib/db/admin"
import { diasEntre, formatFecha, hoyISO } from "@/lib/format"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// Solo nombres, sin montos (decisión del club: la lista se comparte con el grupo).
export default async function MoraPage() {
  const s = await pageSession("tesorero")
  const hoy = hoyISO()
  const [mora, categorias] = await Promise.all([enMora(s.supabase, s.club_id, hoy), categoriasDelClub(s.supabase, s.club_id)])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jugadores en mora ({mora.length})</CardTitle>
        <CardDescription>Solo nombres, sin montos: esta lista es la que se comparte con el grupo.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2">
        {categorias.map((cat) => {
          const lista = mora.filter((m) => m.categoria === cat)
          return (
            <div key={cat}>
              <h3 className="label-caps mb-2">
                {cat} · {lista.length}
              </h3>
              <ul className="space-y-1.5">
                {lista.map((m) => (
                  <li key={m.id} className="flex items-baseline justify-between gap-3">
                    <Link href={`/jugadores/${m.id}`} className="hover:underline">
                      {m.nombre}
                    </Link>
                    <span className="text-[13px] text-muted-foreground">
                      {m.vencidas} {m.vencidas === 1 ? "cobro" : "cobros"} · desde {formatFecha(m.desde, true)} ({diasEntre(m.desde, hoy)} días)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
