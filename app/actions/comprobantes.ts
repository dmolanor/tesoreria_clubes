"use server"

import { getStore } from "@/lib/data"
import { ctxFrom, requireRole } from "@/lib/auth/session"
import { runAction, type ActionResult } from "@/lib/action-result"
import { aceptarComprobante, propuestaPara, rechazarComprobante, subirComprobante, DomainError } from "@/lib/domain/ledger"
import { formatCOP, parseMonto } from "@/lib/format"
import { saveFile } from "@/lib/storage"
import type { ProposalLine } from "@/lib/engine/types"

/** Jugador: sube un comprobante por el monto total, sin elegir a qué evento va. */
export async function subirComprobanteAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("jugador")
    const monto = parseMonto(formData.get("monto"))
    const archivo = formData.get("archivo")
    if (!(archivo instanceof File) || archivo.size === 0) throw new DomainError("Adjunta la foto o PDF del comprobante")
    let archivo_url: string
    try {
      archivo_url = await saveFile(archivo)
    } catch (e) {
      throw new DomainError((e as Error).message)
    }
    await getStore().transaction((db) =>
      subirComprobante(db, ctxFrom(s), { usuario_id: s.usuario.id, monto_total: monto, archivo_url }),
    )
    return `Comprobante de ${formatCOP(monto)} enviado. La tesorería lo revisará.`
  })
}

/** Tesorero: acepta tal cual la propuesta del motor (1 clic desde la bandeja). */
export async function aceptarPropuestaAction(comprobanteId: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("tesorero")
    await getStore().transaction((db) => {
      aceptarComprobante(db, ctxFrom(s), comprobanteId, propuestaPara(db, comprobanteId).lineas)
    })
    return "Comprobante aceptado"
  })
}

/**
 * Tesorero: acepta con el desglose editado. Campos `monto:<obligacion_id>`; si el
 * monto coincide con lo propuesto se conserva la regla de origen, si no, queda como ajuste manual.
 */
export async function aceptarConDesgloseAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("tesorero")
    const comprobanteId = String(formData.get("comprobante_id"))
    await getStore().transaction((db) => {
      const propuesta = propuestaPara(db, comprobanteId)
      const lineas: ProposalLine[] = []
      for (const [key, value] of formData.entries()) {
        if (!key.startsWith("monto:")) continue
        const obligacion_id = key.slice("monto:".length)
        const monto = parseMonto(value)
        if (monto <= 0) continue
        const propuestas = propuesta.lineas.filter((l) => l.obligacion_id === obligacion_id)
        const igual = propuestas.reduce((s, l) => s + l.monto_aplicado, 0) === monto
        lineas.push({ obligacion_id, monto_aplicado: monto, regla_aplicada: igual ? (propuestas[0]?.regla_aplicada ?? null) : null })
      }
      aceptarComprobante(db, ctxFrom(s), comprobanteId, lineas)
    })
    return "Comprobante aceptado con el desglose editado"
  })
}

export async function rechazarAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("tesorero")
    await getStore().transaction((db) =>
      rechazarComprobante(db, ctxFrom(s), String(formData.get("comprobante_id")), String(formData.get("motivo") ?? "")),
    )
    return "Comprobante rechazado — el jugador verá el motivo"
  })
}
