import { ArrowDown, ArrowUp } from "lucide-react"
import { getStore } from "@/lib/data"
import { pageSession } from "@/lib/auth/page"
import { reglasDelClub } from "@/lib/domain/ledger"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ActionButton } from "@/components/action-button"
import { AgregarReglaForm } from "@/components/tesorero/agregar-regla-form"
import { eliminarReglaAction, moverReglaAction, toggleReglaAction } from "@/app/actions/reglas"
import { cn } from "@/lib/utils"

const DESCRIPCION = {
  monto_exacto: "Si lo que queda del pago coincide exactamente con lo que se debe de un cobro, va a ese cobro, sin importar si hay deudas más antiguas.",
  evento_especifico: "Este cobro se cubre antes que cualquier otro mientras la regla esté activa.",
  mas_antiguo_primero: "Lo que quede se aplica a la deuda con fecha límite más antigua, y así sucesivamente. Siempre va de última y no se puede desactivar.",
}

// Tesorero edita; administrador ve en modo lectura (docs/03).
export default async function ReglasPage() {
  const s = await pageSession("tesorero", "administrativo")
  const puedeEditar = s.roles.includes("tesorero")
  const db = await getStore().read()
  const reglas = reglasDelClub(db, s.club_id)
  const conRegla = new Set(reglas.map((r) => r.condicion.evento_cobro_id).filter(Boolean))
  const eventos = db.eventos_cobro.filter((e) => e.club_id === s.club_id && e.estado === "activo" && !conRegla.has(e.id))

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Reglas de conciliación</CardTitle>
          <CardDescription>
            Cuando llega un comprobante, las reglas activas se evalúan en este orden sobre lo que queda del pago. Lo que sobre al final
            queda como saldo a favor del jugador. Siempre puedes ajustar la propuesta antes de aceptar.
            {!puedeEditar ? " Solo el tesorero puede cambiarlas." : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2">
            {reglas.map((r, i) => {
              const fifo = r.tipo === "mas_antiguo_primero"
              return (
                <li key={r.id} className={cn("flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center", !r.activa && "border-dashed text-muted-foreground")}>
                  <span className="text-[24px] font-bold tabular-nums text-faint">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold">
                      {r.nombre} {!r.activa ? <span className="text-[13px] font-medium">(desactivada)</span> : null}
                    </p>
                    <p className="text-[13px] text-muted-foreground">{DESCRIPCION[r.tipo]}</p>
                  </div>
                  {puedeEditar ? (
                    <div className="flex shrink-0 gap-1">
                      {!fifo ? (
                        <>
                          <ActionButton variant="ghost" size="icon" aria-label="Subir prioridad" disabled={i === 0} action={moverReglaAction.bind(null, r.id, "arriba")}>
                            <ArrowUp />
                          </ActionButton>
                          <ActionButton variant="ghost" size="icon" aria-label="Bajar prioridad" disabled={reglas[i + 1]?.tipo === "mas_antiguo_primero"} action={moverReglaAction.bind(null, r.id, "abajo")}>
                            <ArrowDown />
                          </ActionButton>
                          <ActionButton variant="outline" action={toggleReglaAction.bind(null, r.id)}>
                            {r.activa ? "Desactivar" : "Activar"}
                          </ActionButton>
                        </>
                      ) : (
                        <span className="text-[13px] text-muted-foreground">Respaldo fijo</span>
                      )}
                      {r.tipo === "evento_especifico" ? (
                        <ActionButton variant="ghost" confirm="¿Eliminar?" action={eliminarReglaAction.bind(null, r.id)}>
                          Eliminar
                        </ActionButton>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ol>
        </CardContent>
      </Card>

      {puedeEditar ? (
        <Card>
          <CardHeader>
            <CardTitle>Priorizar un cobro</CardTitle>
            <CardDescription>{DESCRIPCION.evento_especifico} Útil, por ejemplo, para asegurar el team fee de un torneo.</CardDescription>
          </CardHeader>
          <CardContent>
            <AgregarReglaForm eventos={eventos.map((e) => ({ id: e.id, nombre: e.nombre }))} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
