// Generador de datos demo (historial jul–sep 2026). Solo lo usa scripts/generate-seed-sql.ts; la app no lo importa.
// Lógica de negocio pura sobre un snapshot `Db` (sin I/O, sin Next).
// Las server actions la envuelven en `store.transaction`; el seed la usa para
// construir un historial coherente. En Supabase esto se volverá RPC/SQL.

import type {
  Bitacora,
  CategoriaEgreso,
  Db,
  EstadoJugador,
  EventoCobro,
  Obligacion,
  ReglaConciliacion,
  TipoBitacora,
  Usuario,
} from "./types"
import type { PendingObligation, ProposalLine } from "@/lib/engine/types"
import { proposeAllocation } from "@/lib/engine/propose"
import { diaLocal, formatCOP } from "@/lib/format"

export class DomainError extends Error {}

export interface Ctx {
  club_id: string
  actor_id: string | null
  now: string // ISO datetime
  newId: () => string
}

// ---------- Lecturas ----------

export function nombreUsuario(db: Db, id: string | null): string {
  if (!id) return "Sistema"
  return db.usuarios.find((u) => u.id === id)?.nombre ?? "Usuario desconocido"
}

export function eventoDe(db: Db, o: Obligacion): EventoCobro {
  const e = db.eventos_cobro.find((e) => e.id === o.evento_cobro_id)
  if (!e) throw new DomainError(`Obligación ${o.id} sin evento`)
  return e
}

/** Lo ya pagado de una obligación: pagos de comprobantes aceptados + saldo a favor consumido en ella. */
export function pagadoObligacion(db: Db, obligacionId: string): number {
  const aceptados = new Set(db.comprobantes.filter((c) => c.estado === "aceptado").map((c) => c.id))
  const porPagos = db.pagos_aplicados
    .filter((p) => p.obligacion_id === obligacionId && aceptados.has(p.comprobante_id))
    .reduce((s, p) => s + p.monto_aplicado, 0)
  const porSaldo = db.saldo_a_favor
    .filter((s) => s.consumido && s.consumido_en_obligacion_id === obligacionId)
    .reduce((s, x) => s + x.monto, 0)
  return porPagos + porSaldo
}

export function saldoObligacion(db: Db, o: Obligacion): number {
  return Math.max(0, o.monto - pagadoObligacion(db, o.id))
}

/** Obligaciones del jugador en eventos activos. */
export function obligacionesActivas(db: Db, usuarioId: string): Obligacion[] {
  const activos = new Set(db.eventos_cobro.filter((e) => e.estado === "activo").map((e) => e.id))
  return db.obligaciones.filter((o) => o.usuario_id === usuarioId && activos.has(o.evento_cobro_id))
}

export function pendientesDe(db: Db, usuarioId: string): PendingObligation[] {
  return obligacionesActivas(db, usuarioId)
    .map((o) => ({
      obligacion_id: o.id,
      evento_cobro_id: o.evento_cobro_id,
      fecha_limite: eventoDe(db, o).fecha_limite,
      saldo_pendiente: saldoObligacion(db, o),
    }))
    .filter((p) => p.saldo_pendiente > 0)
    .sort((a, b) => a.fecha_limite.localeCompare(b.fecha_limite))
}

export function saldoAFavorDisponible(db: Db, usuarioId: string): number {
  return db.saldo_a_favor
    .filter((s) => s.usuario_id === usuarioId && !s.consumido)
    .reduce((sum, s) => sum + s.monto, 0)
}

export type EstadoCuenta = "al_dia" | "pendiente" | "mora"

export function estadoCuenta(db: Db, usuarioId: string, hoy: string): {
  estado: EstadoCuenta
  totalPendiente: number
  totalVencido: number
  proximoVencimiento: string | null
} {
  const pend = pendientesDe(db, usuarioId)
  const totalPendiente = pend.reduce((s, p) => s + p.saldo_pendiente, 0)
  const vencidas = pend.filter((p) => p.fecha_limite < hoy)
  const totalVencido = vencidas.reduce((s, p) => s + p.saldo_pendiente, 0)
  const futuras = pend.filter((p) => p.fecha_limite >= hoy)
  return {
    estado: totalVencido > 0 ? "mora" : totalPendiente > 0 ? "pendiente" : "al_dia",
    totalPendiente,
    totalVencido,
    proximoVencimiento: futuras[0]?.fecha_limite ?? null,
  }
}

export function reglasDelClub(db: Db, clubId: string): ReglaConciliacion[] {
  return db.reglas_conciliacion.filter((r) => r.club_id === clubId).sort((a, b) => a.prioridad - b.prioridad)
}

/** Propuesta del motor para un comprobante pendiente, calculada contra el estado actual. */
export function propuestaPara(db: Db, comprobanteId: string) {
  const c = db.comprobantes.find((c) => c.id === comprobanteId)
  if (!c) throw new DomainError("Comprobante no encontrado")
  const u = db.usuarios.find((u) => u.id === c.usuario_id)!
  return proposeAllocation({
    monto: c.monto_total,
    pendientes: pendientesDe(db, c.usuario_id),
    reglas: reglasDelClub(db, u.club_id),
  })
}

export function tieneRol(db: Db, usuarioId: string, rol: string): boolean {
  return db.roles_usuario.some((r) => r.usuario_id === usuarioId && r.rol === rol && r.activo)
}

export function jugadoresDelClub(db: Db, clubId: string): Usuario[] {
  return db.usuarios.filter((u) => u.club_id === clubId && tieneRol(db, u.id, "jugador"))
}

// ---------- Escrituras ----------

export function log(
  db: Db,
  ctx: Ctx,
  entry: Pick<Bitacora, "tipo" | "objetivo_tipo" | "objetivo_id" | "descripcion"> & { metadata?: Record<string, unknown> },
) {
  db.bitacora.push({
    id: ctx.newId(),
    club_id: ctx.club_id,
    actor_id: ctx.actor_id,
    created_at: ctx.now,
    metadata: {},
    ...entry,
    tipo: entry.tipo as TipoBitacora,
  })
}

function recomputarEstado(db: Db, obligacionId: string) {
  const o = db.obligaciones.find((o) => o.id === obligacionId)
  if (!o) return
  const pagado = pagadoObligacion(db, o.id)
  o.estado = pagado >= o.monto ? "pagado" : pagado > 0 ? "parcial" : "pendiente"
}

/** Consume saldo a favor del jugador contra una obligación (partiendo filas si sobra). */
function consumirSaldoAFavor(db: Db, ctx: Ctx, o: Obligacion) {
  let falta = saldoObligacion(db, o)
  for (const s of db.saldo_a_favor.filter((s) => s.usuario_id === o.usuario_id && !s.consumido)) {
    if (falta <= 0) break
    if (s.monto > falta) {
      db.saldo_a_favor.push({ ...s, id: ctx.newId(), monto: s.monto - falta, created_at: ctx.now })
      s.monto = falta
    }
    s.consumido = true
    s.consumido_en_obligacion_id = o.id
    falta -= s.monto
  }
  recomputarEstado(db, o.id)
}

export function subirComprobante(
  db: Db,
  ctx: Ctx,
  input: { usuario_id: string; monto_total: number; archivo_url: string | null },
) {
  if (!Number.isInteger(input.monto_total) || input.monto_total <= 0) {
    throw new DomainError("El monto debe ser un número entero mayor a 0")
  }
  const id = ctx.newId()
  db.comprobantes.push({
    id,
    usuario_id: input.usuario_id,
    archivo_url: input.archivo_url,
    monto_total: input.monto_total,
    canal: "manual",
    fecha_carga: ctx.now,
    estado: "pendiente",
    motivo_rechazo: null,
    revisado_por: null,
    revisado_en: null,
  })
  log(db, ctx, {
    tipo: "comprobante_subido",
    objetivo_tipo: "comprobante",
    objetivo_id: id,
    descripcion: `${nombreUsuario(db, input.usuario_id)} subió un comprobante de ${formatCOP(input.monto_total)}`,
    metadata: { monto: input.monto_total },
  })
  return id
}

/**
 * Acepta un comprobante con un desglose (la propuesta del motor o una versión
 * editada por el tesorero). Lo que no se asigna a obligaciones queda como saldo a favor.
 */
export function aceptarComprobante(db: Db, ctx: Ctx, comprobanteId: string, lineas: ProposalLine[]) {
  const c = db.comprobantes.find((c) => c.id === comprobanteId)
  if (!c) throw new DomainError("Comprobante no encontrado")
  if (c.estado !== "pendiente") throw new DomainError("Este comprobante ya fue revisado")

  const asignadas = lineas.filter((l) => l.obligacion_id && l.monto_aplicado > 0)
  const totalAsignado = asignadas.reduce((s, l) => s + l.monto_aplicado, 0)
  if (asignadas.some((l) => !Number.isInteger(l.monto_aplicado))) {
    throw new DomainError("Los montos deben ser enteros")
  }
  if (totalAsignado > c.monto_total) {
    throw new DomainError(
      `El desglose suma ${formatCOP(totalAsignado)}, más que el comprobante (${formatCOP(c.monto_total)})`,
    )
  }
  const pendientes = new Map(pendientesDe(db, c.usuario_id).map((p) => [p.obligacion_id, p.saldo_pendiente]))
  const porObligacion = new Map<string, number>()
  for (const l of asignadas) {
    porObligacion.set(l.obligacion_id!, (porObligacion.get(l.obligacion_id!) ?? 0) + l.monto_aplicado)
  }
  for (const [oid, monto] of porObligacion) {
    const saldo = pendientes.get(oid)
    if (saldo === undefined) throw new DomainError("Una línea apunta a una obligación que no está pendiente")
    if (monto > saldo) throw new DomainError(`Una línea aplica ${formatCOP(monto)} a una deuda de ${formatCOP(saldo)}`)
  }

  for (const l of asignadas) {
    db.pagos_aplicados.push({
      id: ctx.newId(),
      comprobante_id: c.id,
      obligacion_id: l.obligacion_id,
      monto_aplicado: l.monto_aplicado,
      regla_aplicada: l.regla_aplicada,
    })
  }
  const sobrante = c.monto_total - totalAsignado
  if (sobrante > 0) {
    db.pagos_aplicados.push({
      id: ctx.newId(),
      comprobante_id: c.id,
      obligacion_id: null,
      monto_aplicado: sobrante,
      regla_aplicada: null,
    })
    db.saldo_a_favor.push({
      id: ctx.newId(),
      usuario_id: c.usuario_id,
      monto: sobrante,
      origen_comprobante_id: c.id,
      consumido: false,
      consumido_en_obligacion_id: null,
      created_at: ctx.now,
    })
  }
  c.estado = "aceptado"
  c.revisado_por = ctx.actor_id
  c.revisado_en = ctx.now
  for (const oid of porObligacion.keys()) recomputarEstado(db, oid)
  if (c.canal === "compensacion") return // el cruce ya queda en la bitácora con 'cruce_registrado'

  log(db, ctx, {
    tipo: "comprobante_aceptado",
    objetivo_tipo: "comprobante",
    objetivo_id: c.id,
    descripcion: `${nombreUsuario(db, ctx.actor_id)} aceptó el comprobante de ${nombreUsuario(db, c.usuario_id)} por ${formatCOP(c.monto_total)}`,
    metadata: { monto: c.monto_total, saldo_a_favor: sobrante, lineas: asignadas.length },
  })
}

export function rechazarComprobante(db: Db, ctx: Ctx, comprobanteId: string, motivo: string) {
  const c = db.comprobantes.find((c) => c.id === comprobanteId)
  if (!c) throw new DomainError("Comprobante no encontrado")
  if (c.estado !== "pendiente") throw new DomainError("Este comprobante ya fue revisado")
  if (!motivo.trim()) throw new DomainError("Escribe el motivo del rechazo — el jugador lo verá")
  c.estado = "rechazado"
  c.motivo_rechazo = motivo.trim()
  c.revisado_por = ctx.actor_id
  c.revisado_en = ctx.now
  log(db, ctx, {
    tipo: "comprobante_rechazado",
    objetivo_tipo: "comprobante",
    objetivo_id: c.id,
    descripcion: `${nombreUsuario(db, ctx.actor_id)} rechazó el comprobante de ${nombreUsuario(db, c.usuario_id)}: ${c.motivo_rechazo}`,
    metadata: { monto: c.monto_total, motivo: c.motivo_rechazo },
  })
}

/** Jugadores a los que aplica un evento según su alcance. Solo activos (TODO(club): ¿lesionados pagan torneos?). */
export function destinatarios(db: Db, clubId: string, alcance: EventoCobro["alcance"], valor: string | null): Usuario[] {
  const activos = jugadoresDelClub(db, clubId).filter((u) => u.estado === "activo")
  if (alcance === "todos") return activos
  if (alcance === "grupo") return activos.filter((u) => u.categoria === valor)
  const ids = new Set((valor ?? "").split(",").filter(Boolean))
  return jugadoresDelClub(db, clubId).filter((u) => ids.has(u.id))
}

export function crearEvento(
  db: Db,
  ctx: Ctx,
  input: Pick<EventoCobro, "nombre" | "monto" | "fecha_limite" | "alcance" | "alcance_valor">,
) {
  if (!input.nombre.trim()) throw new DomainError("El evento necesita un nombre")
  if (!Number.isInteger(input.monto) || input.monto <= 0) throw new DomainError("El monto debe ser mayor a 0")
  const usuarios = destinatarios(db, ctx.club_id, input.alcance, input.alcance_valor)
  if (usuarios.length === 0) throw new DomainError("El alcance elegido no incluye a ningún jugador activo")

  const evento: EventoCobro = {
    id: ctx.newId(),
    club_id: ctx.club_id,
    ...input,
    nombre: input.nombre.trim(),
    fecha_creacion: ctx.now,
    estado: "activo",
  }
  db.eventos_cobro.push(evento)
  let cubiertasConSaldo = 0
  for (const u of usuarios) {
    const o: Obligacion = {
      id: ctx.newId(),
      evento_cobro_id: evento.id,
      usuario_id: u.id,
      monto: input.monto,
      estado: "pendiente",
      created_at: ctx.now,
    }
    db.obligaciones.push(o)
    if (saldoAFavorDisponible(db, u.id) > 0) {
      consumirSaldoAFavor(db, ctx, o)
      cubiertasConSaldo++
    }
  }
  log(db, ctx, {
    tipo: "evento_cobro_creado",
    objetivo_tipo: "evento_cobro",
    objetivo_id: evento.id,
    descripcion: `${nombreUsuario(db, ctx.actor_id)} creó "${evento.nombre}" (${formatCOP(evento.monto)} × ${usuarios.length} jugadores)`,
    metadata: { monto: evento.monto, jugadores: usuarios.length, cubiertas_con_saldo_a_favor: cubiertasConSaldo },
  })
  return evento.id
}

export function editarEvento(db: Db, ctx: Ctx, id: string, input: { nombre: string; fecha_limite: string }) {
  const e = db.eventos_cobro.find((e) => e.id === id && e.club_id === ctx.club_id)
  if (!e) throw new DomainError("Evento no encontrado")
  if (!input.nombre.trim()) throw new DomainError("El evento necesita un nombre")
  // Monto y alcance no se editan: cambiarían obligaciones con pagos ya aplicados. Cancelar y crear otro.
  e.nombre = input.nombre.trim()
  e.fecha_limite = input.fecha_limite
}

/** Cancela un evento; lo que ya se había pagado de él vuelve al jugador como saldo a favor. TODO(club): confirmar. */
export function cancelarEvento(db: Db, ctx: Ctx, id: string) {
  const e = db.eventos_cobro.find((e) => e.id === id && e.club_id === ctx.club_id)
  if (!e) throw new DomainError("Evento no encontrado")
  if (e.estado === "cancelado") throw new DomainError("El evento ya estaba cancelado")
  let devuelto = 0
  for (const o of db.obligaciones.filter((o) => o.evento_cobro_id === e.id)) {
    const pagado = pagadoObligacion(db, o.id)
    if (pagado > 0) {
      devuelto += pagado
      db.saldo_a_favor.push({
        id: ctx.newId(),
        usuario_id: o.usuario_id,
        monto: pagado,
        origen_comprobante_id: null,
        consumido: false,
        consumido_en_obligacion_id: null,
        created_at: ctx.now,
      })
    }
  }
  e.estado = "cancelado"
  log(db, ctx, {
    tipo: "evento_cobro_cancelado",
    objetivo_tipo: "evento_cobro",
    objetivo_id: e.id,
    descripcion: `${nombreUsuario(db, ctx.actor_id)} canceló "${e.nombre}"${devuelto ? ` — ${formatCOP(devuelto)} pasan a saldo a favor` : ""}`,
    metadata: { devuelto },
  })
}

// Tarifa fija de lesionado/inactivo (las configura el club en `tarifas_estado`); activo usa el monto
// del evento de mensualidad y retirado es 0. El prorrateo es incremental sobre la tarifa de cada
// estado, no un piso fijo — ver `cambiar_estado_miembro` en supabase/migrations.
export const TARIFA_LESIONADO = 40_000
export const TARIFA_INACTIVO = 60_000

function tarifaDe(estado: EstadoJugador, montoEvento: number): number {
  if (estado === "activo") return montoEvento
  if (estado === "lesionado") return TARIFA_LESIONADO
  if (estado === "inactivo") return TARIFA_INACTIVO
  return 0 // retirado
}

export function cambiarEstadoJugador(db: Db, ctx: Ctx, usuarioId: string, estado: EstadoJugador) {
  const u = db.usuarios.find((u) => u.id === usuarioId && u.club_id === ctx.club_id)
  if (!u) throw new DomainError("Jugador no encontrado")
  if (u.estado === estado) return
  const anterior = u.estado
  u.estado = estado

  const prorrateos: string[] = []
  const hoy = diaLocal(ctx.now)
  const mes = hoy.slice(0, 7)
  const dia = Number(hoy.slice(8, 10))
  const [y, m] = mes.split("-").map(Number)
  const diasMes = new Date(y, m, 0).getDate()
  const r = (diasMes - dia + 1) / diasMes
  // TODO(club): identificar mensualidades por nombre es provisional; agregar un tipo de evento al modelo.
  const mensualidades = obligacionesActivas(db, u.id).filter((o) => {
    const e = eventoDe(db, o)
    return e.nombre.toLowerCase().startsWith("mensualidad") && e.fecha_limite.startsWith(mes)
  })
  for (const o of mensualidades) {
    const e = eventoDe(db, o)
    const nuevo = Math.max(Math.round((o.monto - tarifaDe(anterior, e.monto) * r + tarifaDe(estado, e.monto) * r) / 100) * 100, 0)
    if (nuevo === o.monto) continue
    const pagado = pagadoObligacion(db, o.id)
    prorrateos.push(`${e.nombre}: ${formatCOP(o.monto)} → ${formatCOP(nuevo)}`)
    o.monto = nuevo
    if (pagado > nuevo) {
      db.saldo_a_favor.push({
        id: ctx.newId(),
        usuario_id: u.id,
        monto: pagado - nuevo,
        origen_comprobante_id: null,
        consumido: false,
        consumido_en_obligacion_id: null,
        created_at: ctx.now,
      })
    }
    recomputarEstado(db, o.id)
  }
  log(db, ctx, {
    tipo: "jugador_estado_cambiado",
    objetivo_tipo: "usuario",
    objetivo_id: u.id,
    descripcion: `${nombreUsuario(db, ctx.actor_id)} cambió a ${u.nombre} de ${anterior} a ${estado}${prorrateos.length ? ` (prorrateo: ${prorrateos.join("; ")})` : ""}`,
    metadata: { anterior, nuevo: estado, prorrateos },
  })
}

export function crearJugador(
  db: Db,
  ctx: Ctx,
  input: { nombre: string; correo: string; categoria: Usuario["categoria"] },
): "creado" | "existente" {
  const correo = input.correo.trim().toLowerCase()
  if (!input.nombre.trim() || !correo.includes("@")) throw new DomainError(`Fila inválida: ${input.nombre} <${input.correo}>`)
  if (db.usuarios.some((u) => u.correo === correo)) return "existente"
  const id = ctx.newId()
  db.usuarios.push({
    id,
    club_id: ctx.club_id,
    nombre: input.nombre.trim(),
    correo,
    categoria: input.categoria,
    estado: "activo",
    created_at: ctx.now,
  })
  db.roles_usuario.push({ id: ctx.newId(), usuario_id: id, club_id: ctx.club_id, rol: "jugador", activo: true, created_at: ctx.now })
  log(db, ctx, {
    tipo: "jugador_creado",
    objetivo_tipo: "usuario",
    objetivo_id: id,
    descripcion: `${nombreUsuario(db, ctx.actor_id)} agregó a ${input.nombre.trim()} (${input.categoria ?? "sin categoría"}) — invitación simulada a ${correo}`,
    metadata: { correo },
  })
  return "creado"
}

export function setRol(db: Db, ctx: Ctx, usuarioId: string, rol: RolName, activo: boolean) {
  const existing = db.roles_usuario.find((r) => r.usuario_id === usuarioId && r.rol === rol && r.club_id === ctx.club_id)
  if (existing) existing.activo = activo
  else if (activo) {
    db.roles_usuario.push({ id: ctx.newId(), usuario_id: usuarioId, club_id: ctx.club_id, rol, activo, created_at: ctx.now })
  }
  if (!db.roles_usuario.some((r) => r.usuario_id === usuarioId && r.activo)) {
    throw new DomainError("Un usuario debe conservar al menos un rol activo")
  }
}
type RolName = "administrativo" | "tesorero" | "jugador"

// ---------- Reglas de conciliación (solo tesorero) ----------

function renumerar(reglas: ReglaConciliacion[], now: string) {
  // FIFO siempre al final: es el fallback determinístico (docs/03).
  const ordered = [...reglas.filter((r) => r.tipo !== "mas_antiguo_primero"), ...reglas.filter((r) => r.tipo === "mas_antiguo_primero")]
  ordered.forEach((r, i) => {
    if (r.prioridad !== i + 1) r.updated_at = now
    r.prioridad = i + 1
  })
}

function logRegla(db: Db, ctx: Ctx, r: ReglaConciliacion, accion: string) {
  log(db, ctx, {
    tipo: "regla_conciliacion_cambiada",
    objetivo_tipo: "regla",
    objetivo_id: r.id,
    descripcion: `${nombreUsuario(db, ctx.actor_id)} ${accion} la regla "${r.nombre}"`,
    metadata: { accion, tipo: r.tipo },
  })
}

export function moverRegla(db: Db, ctx: Ctx, id: string, dir: "arriba" | "abajo") {
  const reglas = reglasDelClub(db, ctx.club_id)
  const i = reglas.findIndex((r) => r.id === id)
  const j = dir === "arriba" ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= reglas.length) return
  if (reglas[i].tipo === "mas_antiguo_primero" || reglas[j].tipo === "mas_antiguo_primero") {
    throw new DomainError("La regla 'más antiguo primero' siempre va de última: es el respaldo cuando nada más aplica")
  }
  ;[reglas[i], reglas[j]] = [reglas[j], reglas[i]]
  renumerar(reglas, ctx.now)
  logRegla(db, ctx, reglas[j], dir === "arriba" ? "subió de prioridad" : "bajó de prioridad")
}

export function toggleRegla(db: Db, ctx: Ctx, id: string) {
  const r = db.reglas_conciliacion.find((r) => r.id === id && r.club_id === ctx.club_id)
  if (!r) throw new DomainError("Regla no encontrada")
  if (r.tipo === "mas_antiguo_primero") throw new DomainError("La regla 'más antiguo primero' no se puede desactivar")
  r.activa = !r.activa
  r.updated_at = ctx.now
  logRegla(db, ctx, r, r.activa ? "activó" : "desactivó")
}

export function agregarReglaEvento(db: Db, ctx: Ctx, eventoId: string) {
  const e = db.eventos_cobro.find((e) => e.id === eventoId && e.club_id === ctx.club_id && e.estado === "activo")
  if (!e) throw new DomainError("Evento no encontrado")
  const r: ReglaConciliacion = {
    id: ctx.newId(),
    club_id: ctx.club_id,
    nombre: `Priorizar "${e.nombre}"`,
    tipo: "evento_especifico",
    condicion: { evento_id: e.id },
    accion: {},
    prioridad: 0, // se inserta de primera
    activa: true,
    creado_por: ctx.actor_id,
    created_at: ctx.now,
    updated_at: ctx.now,
  }
  db.reglas_conciliacion.push(r)
  renumerar(reglasDelClub(db, ctx.club_id), ctx.now)
  logRegla(db, ctx, r, "creó")
}

export function eliminarRegla(db: Db, ctx: Ctx, id: string) {
  const r = db.reglas_conciliacion.find((r) => r.id === id && r.club_id === ctx.club_id)
  if (!r) throw new DomainError("Regla no encontrada")
  if (r.tipo !== "evento_especifico") throw new DomainError("Las reglas por defecto se desactivan, no se eliminan")
  db.reglas_conciliacion = db.reglas_conciliacion.filter((x) => x.id !== id)
  renumerar(reglasDelClub(db, ctx.club_id), ctx.now)
  logRegla(db, ctx, r, "eliminó")
}

export function reglasPorDefecto(ctx: Ctx): ReglaConciliacion[] {
  const base = { club_id: ctx.club_id, accion: {}, condicion: {}, activa: true, creado_por: null, created_at: ctx.now, updated_at: ctx.now }
  return [
    { ...base, id: ctx.newId(), nombre: "Monto exacto", tipo: "monto_exacto", prioridad: 1 },
    { ...base, id: ctx.newId(), nombre: "Más antiguo primero", tipo: "mas_antiguo_primero", prioridad: 2 },
  ]
}

// ---------- Conciliación mensual ----------

/** Suma de comprobantes aceptados cuya fecha de carga cae en el mes (≈ fecha de la transferencia).
 * Las compensaciones de un cruce no mueven el banco: se excluyen, igual que en la base. */
export function totalAceptadoMes(db: Db, clubId: string, mes: string): number {
  const clubUsers = new Set(db.usuarios.filter((u) => u.club_id === clubId).map((u) => u.id))
  return db.comprobantes
    .filter(
      (c) =>
        c.estado === "aceptado" && c.canal !== "compensacion" && clubUsers.has(c.usuario_id) && diaLocal(c.fecha_carga).startsWith(mes.slice(0, 7)),
    )
    .reduce((s, c) => s + c.monto_total, 0)
}

/** Suma de egresos no anulados cuya fecha cae en el mes (lo mismo que calcula la base).
 * El egreso de un cruce tampoco mueve el banco: se excluye, se anula con la compensación. */
export function totalEgresosMes(db: Db, clubId: string, mes: string): number {
  return db.egresos
    .filter((e) => e.club_id === clubId && !e.anulado_en && !e.comprobante_id && e.fecha.startsWith(mes.slice(0, 7)))
    .reduce((s, e) => s + e.monto, 0)
}

export function registrarEgreso(
  db: Db,
  ctx: Ctx,
  input: {
    id: string
    fecha: string
    monto: number
    concepto: string
    categoria: CategoriaEgreso
    categoria_otro?: string | null
    evento_id?: string | null
    comprobante_id?: string | null
  },
) {
  db.egresos.push({
    ...input,
    categoria_otro: input.categoria_otro ?? null,
    evento_id: input.evento_id ?? null,
    comprobante_id: input.comprobante_id ?? null,
    club_id: ctx.club_id,
    creado_por: ctx.actor_id ?? "",
    anulado_en: null,
    created_at: ctx.now,
  })
  if (input.comprobante_id) return // el cruce ya queda en la bitácora con 'cruce_registrado'
  log(db, ctx, {
    tipo: "egreso_registrado",
    objetivo_tipo: "egreso",
    objetivo_id: input.id,
    descripcion: `${nombreUsuario(db, ctx.actor_id)} registró un egreso de ${formatCOP(input.monto)}: ${input.concepto}`,
    metadata: { monto: input.monto, categoria: input.categoria, fecha: input.fecha },
  })
}

/**
 * Cruce de cuentas: un jugador que trabaja para el club (ej. entrena a cambio de un pago).
 * Un comprobante de compensación (sin plata real) se acepta con la propuesta del motor —
 * misma `aceptarComprobante` que usa la bandeja, nunca FIFO a mano— y un egreso de nómina
 * enlazado a ese comprobante. Ambos se excluyen del cuadre: se anulan entre sí frente al banco.
 */
export function registrarCruce(
  db: Db,
  ctx: Ctx,
  input: { comprobanteId: string; egresoId: string; usuario_id: string; monto: number; fecha: string; concepto: string },
) {
  db.comprobantes.push({
    id: input.comprobanteId,
    usuario_id: input.usuario_id,
    archivo_url: null,
    monto_total: input.monto,
    canal: "compensacion",
    fecha_carga: ctx.now,
    estado: "pendiente",
    motivo_rechazo: null,
    revisado_por: null,
    revisado_en: null,
  })
  const propuesta = proposeAllocation({
    monto: input.monto,
    pendientes: pendientesDe(db, input.usuario_id),
    reglas: reglasDelClub(db, ctx.club_id),
  })
  aceptarComprobante(db, ctx, input.comprobanteId, propuesta.lineas)
  registrarEgreso(db, ctx, {
    id: input.egresoId,
    fecha: input.fecha,
    monto: input.monto,
    concepto: input.concepto,
    categoria: "nomina",
    comprobante_id: input.comprobanteId,
  })
  log(db, ctx, {
    tipo: "cruce_registrado",
    objetivo_tipo: "comprobante",
    objetivo_id: input.comprobanteId,
    descripcion: `${nombreUsuario(db, ctx.actor_id)} registró un cruce de ${formatCOP(input.monto)} para ${nombreUsuario(db, input.usuario_id)}: ${input.concepto}`,
    metadata: { monto: input.monto, usuario_id: input.usuario_id },
  })
}

export function anularEgreso(db: Db, ctx: Ctx, id: string) {
  const e = db.egresos.find((e) => e.id === id && e.club_id === ctx.club_id)
  if (!e) throw new DomainError("Egreso no encontrado")
  if (e.anulado_en) throw new DomainError("Este egreso ya estaba anulado")
  e.anulado_en = ctx.now
  log(db, ctx, {
    tipo: "egreso_anulado",
    objetivo_tipo: "egreso",
    objetivo_id: e.id,
    descripcion: `${nombreUsuario(db, ctx.actor_id)} anuló el egreso de ${formatCOP(e.monto)}: ${e.concepto}`,
    metadata: { monto: e.monto, categoria: e.categoria, fecha: e.fecha },
  })
}

export function guardarConciliacion(
  db: Db,
  ctx: Ctx,
  input: { mes: string; saldo_inicial: number; saldo_final: number; notas: string | null },
) {
  const mes = `${input.mes.slice(0, 7)}-01`
  const total_aceptado = totalAceptadoMes(db, ctx.club_id, mes)
  const total_egresos = totalEgresosMes(db, ctx.club_id, mes)
  const diferencia = input.saldo_final - input.saldo_inicial - (total_aceptado - total_egresos)
  const existing = db.conciliaciones.find((c) => c.club_id === ctx.club_id && c.mes === mes)
  const row = {
    club_id: ctx.club_id,
    mes,
    saldo_inicial: input.saldo_inicial,
    saldo_final: input.saldo_final,
    total_aceptado,
    total_egresos,
    diferencia,
    notas: input.notas,
    creado_por: ctx.actor_id ?? "",
    created_at: ctx.now,
  }
  let id: string
  if (existing) {
    Object.assign(existing, row)
    id = existing.id
  } else {
    id = ctx.newId()
    db.conciliaciones.push({ id, ...row })
  }
  log(db, ctx, {
    tipo: "conciliacion_guardada",
    objetivo_tipo: "conciliacion",
    objetivo_id: id,
    descripcion: `${nombreUsuario(db, ctx.actor_id)} guardó la conciliación de ${mes.slice(0, 7)} — diferencia ${formatCOP(diferencia)}`,
    metadata: { total_aceptado, total_egresos, diferencia },
  })
  return { total_aceptado, total_egresos, diferencia }
}
