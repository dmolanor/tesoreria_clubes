import { createClient } from "@/lib/supabase/server"
import { tareasDelClub } from "@/lib/db/tareas"
import { formatFecha } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ActionButton } from "@/components/action-button"
import { cancelarTareaAction } from "@/app/actions/tareas"

/**
 * Tarjeta "Tareas pendientes" para administración y tesorería. Se fetchea sola (`clubId` es lo
 * único que necesita) para que insertarla en una página sea una sola línea.
 */
export async function TareasPendientes({ clubId, esAdmin = false }: { clubId: string; esAdmin?: boolean }) {
  const sb = await createClient()
  const tareas = await tareasDelClub(sb, clubId)
  if (tareas.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tareas pendientes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {tareas.map((t) => (
          <div key={t.id} className="space-y-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[15px] font-semibold">{t.nombre}</p>
              <span className="text-[13px] text-muted-foreground">vence {formatFecha(t.fecha_limite, true)}</span>
            </div>
            <p className="text-[13px] text-muted-foreground">
              {t.completadas} de {t.total} hechas
            </p>
            {t.pendientes.length > 0 ? (
              <details className="text-[13px]">
                <summary className="cursor-pointer text-muted-foreground underline underline-offset-2">Ver quién falta ({t.pendientes.length})</summary>
                <ul className="mt-1 space-y-0.5 pl-1 text-muted-foreground">
                  {t.pendientes.map((p) => (
                    <li key={p.id}>{p.nombre}</li>
                  ))}
                </ul>
              </details>
            ) : null}
            {esAdmin ? (
              <ActionButton variant="ghost" className="h-auto p-0 text-[13px] underline underline-offset-2" confirm="¿Cancelar esta tarea?" action={cancelarTareaAction.bind(null, t.id)}>
                Cancelar
              </ActionButton>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
