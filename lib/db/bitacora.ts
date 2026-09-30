import "server-only"
import type { Supabase } from "@/lib/supabase/server"
import type { TipoBitacora } from "./types"

export interface BitacoraItem {
  id: number
  tipo: TipoBitacora
  descripcion: string
  created_at: string
}

export const PAGINA = 25

/** Página de bitácora. Cursor = "created_at|id" de la última fila vista (orden descendente). */
export async function paginaBitacora(
  sb: Supabase,
  clubId: string,
  f: { cursor?: string | null; tipos?: TipoBitacora[]; actorId?: string | null; desde?: string | null },
): Promise<{ items: BitacoraItem[]; nextCursor: string | null }> {
  let q = sb
    .from("bitacora")
    .select("id, tipo, descripcion, created_at")
    .eq("club_id", clubId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGINA + 1)
  if (f.tipos?.length) q = q.in("tipo", f.tipos)
  if (f.actorId) q = q.eq("actor_id", f.actorId)
  if (f.desde) q = q.gte("created_at", f.desde)
  if (f.cursor) {
    const [ts, id] = f.cursor.split("|")
    q = q.or(`created_at.lt."${ts}",and(created_at.eq."${ts}",id.lt.${id})`)
  }
  const { data, error } = await q
  if (error) throw error
  const filas = data ?? []
  const items = filas.slice(0, PAGINA)
  const ultima = items[items.length - 1]
  return { items, nextCursor: filas.length > PAGINA && ultima ? `${ultima.created_at}|${ultima.id}` : null }
}

export async function actoresBitacora(sb: Supabase, clubId: string) {
  const { data, error } = await sb.from("bitacora").select("actor_id").eq("club_id", clubId).not("actor_id", "is", null)
  if (error) throw error
  const ids = [...new Set((data ?? []).map((r) => r.actor_id!))]
  if (!ids.length) return []
  const { data: m, error: e2 } = await sb.from("miembros").select("id, nombre").in("id", ids).order("nombre")
  if (e2) throw e2
  return m ?? []
}
