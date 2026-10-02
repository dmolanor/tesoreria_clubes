import Link from "next/link"
import { pageSession } from "@/lib/auth/page"
import { egresosMes } from "@/lib/db/egresos"
import { eventosDelClub } from "@/lib/db/admin"
import { urlsFirmadas } from "@/lib/db/cuenta"
import { rangoMes } from "@/lib/cuadre"
import { formatCOP, formatMes, hoyISO } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EgresoForm } from "@/components/egresos/egreso-form"
import { EgresosList } from "@/components/egresos/egresos-list"
import { ActivityPanel } from "@/components/activity-panel"
import { cn } from "@/lib/utils"

function mesesHasta(hoy: string, n: number): string[] {
  const [y, m] = hoy.split("-").map(Number)
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 10))
}

export default async function EgresosPage(props: PageProps<"/egresos">) {
  const s = await pageSession("tesorero", "administrativo")
  const sb = s.supabase
  const meses = mesesHasta(hoyISO(), 4)
  const { mes: raw } = await props.searchParams
  const mes = typeof raw === "string" && meses.includes(raw) ? raw : meses[0]

  const [egresos, eventos] = await Promise.all([egresosMes(sb, s.club_id, mes), eventosDelClub(sb, s.club_id)])
  const soportes = await urlsFirmadas(sb, egresos.items.map((e) => e.soporte_path))
  const activos = eventos.filter((e) => e.estado === "activo").map((e) => ({ id: e.id, nombre: e.nombre }))
  // El formulario solo acepta fechas del mes que se está viendo (y nunca futuras).
  const { inicio, fin } = rangoMes(mes)
  const ultimoDia = new Date(Date.parse(`${fin}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
  const fechaMax = ultimoDia < hoyISO() ? ultimoDia : hoyISO()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Egresos</CardTitle>
          <div className="flex flex-wrap gap-1 pt-2">
            {meses.map((m) => (
              <Link
                key={m}
                href={`/egresos?mes=${m}`}
                className={cn("rounded-md px-3 py-1.5 text-[13px] font-medium", m === mes ? "bg-ink text-paper" : "bg-muted text-muted-foreground hover:text-foreground")}
              >
                {formatMes(m)}
              </Link>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-[13px] text-muted-foreground">
            {egresos.vigentes === 0
              ? "Canchas, nómina, uniformes, torneos o liga: lo que salga de la cuenta se descuenta del cuadre mensual."
              : `${egresos.vigentes} ${egresos.vigentes === 1 ? "egreso" : "egresos"} por ${formatCOP(egresos.total)}, descontados del cuadre de ${formatMes(mes).toLowerCase()}.`}
          </p>
          <EgresoForm min={inicio} max={fechaMax} eventos={activos} />
          <EgresosList items={egresos.items} soportes={soportes} />
        </CardContent>
      </Card>
      <ActivityPanel tipos={["egreso_registrado", "egreso_anulado", "cruce_registrado"]} />
    </div>
  )
}
