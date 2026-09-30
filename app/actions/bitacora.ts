"use server"

import { requireRole } from "@/lib/auth/session"
import { actoresBitacora as actores, paginaBitacora, type BitacoraItem } from "@/lib/db/bitacora"
import { TIPOS_BITACORA, type TipoBitacora } from "@/lib/db/types"

export type { BitacoraItem }

/** Bitácora paginada por cursor, filtrable por tipo, actor y fecha. Solo lectura (RLS: tesorería y administración). */
export async function cargarBitacora(input: {
  cursor?: string | null
  tipos?: TipoBitacora[]
  actor_id?: string | null
  desde?: string | null
}): Promise<{ items: BitacoraItem[]; nextCursor: string | null }> {
  const s = await requireRole("tesorero", "administrativo")
  return paginaBitacora(s.supabase, s.club_id, {
    cursor: input.cursor,
    tipos: input.tipos?.filter((t) => TIPOS_BITACORA.includes(t)),
    actorId: input.actor_id,
    desde: input.desde,
  })
}

export async function actoresBitacora() {
  const s = await requireRole("tesorero", "administrativo")
  return actores(s.supabase, s.club_id)
}
