"use server"

import { requireRole } from "@/lib/auth/session"
import { check, runAction, DomainError, type ActionResult } from "@/lib/action-result"
import { parseMonto } from "@/lib/format"
import type { AlcanceCobro, TipoCobro } from "@/lib/db/types"

export async function crearEventoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("administrativo")
    const alcance = String(formData.get("alcance")) as AlcanceCobro
    const fecha_limite = String(formData.get("fecha_limite") ?? "")
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_limite)) throw new DomainError("Elige la fecha límite")
    const nombre = String(formData.get("nombre") ?? "").trim()
    if (!nombre) throw new DomainError("El evento necesita un nombre")
    const monto = parseMonto(formData.get("monto"))
    if (monto <= 0) throw new DomainError("El monto debe ser mayor a 0")
    const miembros = formData.getAll("jugadores").map(String)
    if (alcance === "individual" && miembros.length === 0) throw new DomainError("Elige al menos un jugador")

    const eventoId = check(
      await s.supabase.rpc("crear_evento", {
        p_club_id: s.club_id,
        p_nombre: nombre,
        p_tipo: String(formData.get("tipo") ?? "otro") as TipoCobro,
        p_monto: monto,
        p_fecha_limite: fecha_limite,
        p_alcance: alcance,
        p_categoria: alcance === "grupo" ? String(formData.get("categoria")) : undefined,
        p_miembro_ids: alcance === "individual" ? miembros : undefined,
      }),
    )
    const { count } = await s.supabase.from("obligaciones").select("id", { count: "exact", head: true }).eq("evento_id", eventoId ?? "")
    return `Evento creado. ${count ?? 0} jugadores ya lo ven en su estado de cuenta`
  })
}

export async function editarEventoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("administrativo")
    const nombre = String(formData.get("nombre") ?? "").trim()
    if (!nombre) throw new DomainError("El evento necesita un nombre")
    // Monto y alcance no se editan (no hay grant): cambiarían deudas con pagos ya aplicados.
    check(
      await s.supabase
        .from("eventos_cobro")
        .update({ nombre, fecha_limite: String(formData.get("fecha_limite")) })
        .eq("id", String(formData.get("id"))),
    )
    return "Evento actualizado"
  })
}

export async function cancelarEventoAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("administrativo")
    check(await s.supabase.rpc("cancelar_evento", { p_evento_id: id }))
    return "Evento cancelado. Lo pagado quedó como saldo a favor"
  })
}
