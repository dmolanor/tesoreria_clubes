import "server-only"
import type { Db } from "@/lib/data/types"
import { jugadoresDelClub } from "@/lib/domain/ledger"

export function opcionesJugadores(db: Db, clubId: string) {
  return jugadoresDelClub(db, clubId)
    .filter((u) => u.estado !== "retirado")
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map((u) => ({ id: u.id, nombre: u.nombre, categoria: u.categoria }))
}
