import "server-only"
import type { Db } from "@/lib/data/types"
import { estadoCuenta, jugadoresDelClub, pendientesDe } from "@/lib/domain/ledger"

/** Jugadores con obligaciones vencidas sin pagar, del atraso más antiguo al más reciente. */
export function jugadoresEnMora(db: Db, clubId: string, hoy: string) {
  return jugadoresDelClub(db, clubId)
    .map((u) => {
      const cuenta = estadoCuenta(db, u.id, hoy)
      const vencidas = pendientesDe(db, u.id).filter((p) => p.fecha_limite < hoy)
      return { u, cuenta, vencidas, desde: vencidas[0]?.fecha_limite ?? null }
    })
    .filter((x) => x.cuenta.estado === "mora")
    .sort((a, b) => a.desde!.localeCompare(b.desde!))
}
