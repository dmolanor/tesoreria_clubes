"use server"

import { getStore } from "@/lib/data"
import { requireRole } from "@/lib/auth/session"
import { TIPOS_BITACORA, type TipoBitacora } from "@/lib/data/types"

export interface BitacoraItem {
  id: string
  tipo: TipoBitacora
  descripcion: string
  created_at: string
}

const PAGE = 25

/** Bitácora paginada por cursor (created_at|id), filtrable por tipo, actor y fecha. Solo lectura. */
export async function cargarBitacora(input: {
  cursor?: string | null
  tipos?: TipoBitacora[]
  actor_id?: string | null
  desde?: string | null
}): Promise<{ items: BitacoraItem[]; nextCursor: string | null }> {
  const s = await requireRole("tesorero", "administrativo")
  const db = await getStore().read()
  const tipos = new Set(input.tipos?.length ? input.tipos.filter((t) => TIPOS_BITACORA.includes(t)) : TIPOS_BITACORA)
  const key = (b: { created_at: string; id: string }) => `${b.created_at}|${b.id}`
  const rows = db.bitacora
    .filter(
      (b) =>
        b.club_id === s.club_id &&
        tipos.has(b.tipo) &&
        (!input.actor_id || b.actor_id === input.actor_id) &&
        (!input.desde || b.created_at >= input.desde) &&
        (!input.cursor || key(b) < input.cursor),
    )
    .sort((a, b) => key(b).localeCompare(key(a)))
  const items = rows.slice(0, PAGE).map(({ id, tipo, descripcion, created_at }) => ({ id, tipo, descripcion, created_at }))
  return { items, nextCursor: rows.length > PAGE ? key(rows[PAGE - 1]) : null }
}

export async function actoresBitacora(): Promise<Array<{ id: string; nombre: string }>> {
  const s = await requireRole("tesorero", "administrativo")
  const db = await getStore().read()
  const ids = new Set(db.bitacora.filter((b) => b.club_id === s.club_id && b.actor_id).map((b) => b.actor_id!))
  return db.usuarios.filter((u) => ids.has(u.id)).map((u) => ({ id: u.id, nombre: u.nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre))
}
