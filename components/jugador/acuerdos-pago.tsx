import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CuotasTabla } from "@/components/tesorero/acuerdo-item"
import type { AcuerdoVista } from "@/lib/db/acuerdos"
import { formatCOP } from "@/lib/format"

/** Acuerdos del jugador, solo lectura (los registra la tesorería). */
export function AcuerdosPago({ acuerdos }: { acuerdos: AcuerdoVista[] }) {
  const activos = acuerdos.filter((a) => a.estado === "activo")
  if (!activos.length) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>Acuerdos de pago</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activos.map((a) => (
          <div key={a.id}>
            <p className="text-[15px] font-semibold">
              {a.evento} · <span className="tabular-nums">{formatCOP(a.cuotas.reduce((s, c) => s + c.monto, 0))}</span>
            </p>
            <CuotasTabla pagado={a.pagado_deuda} cuotas={a.cuotas} />
            {a.notas ? <p className="mt-1 text-[13px] text-muted-foreground">{a.notas}</p> : null}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
