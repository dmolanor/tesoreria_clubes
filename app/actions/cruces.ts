"use server"

import { requireRole } from "@/lib/auth/session"
import { check, runAction, DomainError, type ActionResult } from "@/lib/action-result"
import { comoReglasMotor, lineasRpc, pendientesPorMiembro, reglasDelClub } from "@/lib/db/tesoreria"
import { proposeAllocation } from "@/lib/engine/propose"
import { formatCOP, hoyISO, parseMonto } from "@/lib/format"

/**
 * Tesorero: registra un cruce de cuentas con un jugador que trabaja para el club (ej. entrena a
 * cambio de un pago). El desglose lo calcula el motor de reglas, igual que la bandeja de
 * comprobantes — nunca FIFO a mano. La base inserta el comprobante de compensación, lo acepta y
 * registra el egreso de nómina enlazado, en una sola transacción (`registrar_cruce`).
 */
export async function registrarCruceAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("tesorero")
    const miembro_id = String(formData.get("miembro_id") ?? "")
    if (!miembro_id) throw new DomainError("Falta el jugador")
    const monto = parseMonto(formData.get("monto"))
    if (monto <= 0) throw new DomainError("Escribe el monto del cruce")
    const fecha = String(formData.get("fecha") || hoyISO())
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha > hoyISO()) throw new DomainError("La fecha del cruce no puede ser posterior a hoy")
    const concepto = String(formData.get("concepto") ?? "").trim()
    if (!concepto) throw new DomainError("Escribe el concepto del cruce (ej. Entrenamiento septiembre)")

    const [pendientesPorMiembroMap, reglas] = await Promise.all([
      pendientesPorMiembro(s.supabase, [miembro_id]),
      reglasDelClub(s.supabase, s.club_id).then(comoReglasMotor),
    ])
    const propuesta = proposeAllocation({ monto, pendientes: pendientesPorMiembroMap.get(miembro_id) ?? [], reglas })

    check(
      await s.supabase.rpc("registrar_cruce", {
        p_miembro_id: miembro_id,
        p_monto: monto,
        p_fecha: fecha,
        p_concepto: concepto,
        p_lineas: lineasRpc(propuesta.lineas),
      }),
    )
    return `Cruce de ${formatCOP(monto)} registrado`
  })
}
