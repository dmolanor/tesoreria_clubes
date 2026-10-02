// Tipos del dominio. Reflejan 1:1 las tablas de docs/02-data-model.md
// (nombres de tablas/columnas en español a propósito — ver CLAUDE.md).
// Dinero: enteros en COP.

export type Uuid = string
export type IsoDate = string // 'YYYY-MM-DD'
export type IsoDateTime = string

export type Categoria = "Élite" | "Junior"
export type EstadoJugador = "activo" | "lesionado" | "inactivo" | "retirado"
export type Rol = "administrativo" | "tesorero" | "jugador"

export interface Club {
  id: Uuid
  nombre: string
  created_at: IsoDateTime
}

export interface Usuario {
  id: Uuid
  club_id: Uuid
  nombre: string
  correo: string
  categoria: Categoria | null
  estado: EstadoJugador
  created_at: IsoDateTime
}

export interface RolUsuario {
  id: Uuid
  usuario_id: Uuid
  club_id: Uuid
  rol: Rol
  activo: boolean
  created_at: IsoDateTime
}

export type Alcance = "todos" | "grupo" | "individual"

export interface EventoCobro {
  id: Uuid
  club_id: Uuid
  nombre: string
  monto: number
  fecha_limite: IsoDate
  alcance: Alcance
  alcance_valor: string | null // categoría o lista de usuario_id separados por coma
  fecha_creacion: IsoDateTime
  estado: "activo" | "cancelado"
}

export type EstadoObligacion = "pendiente" | "parcial" | "pagado"

export interface Obligacion {
  id: Uuid
  evento_cobro_id: Uuid
  usuario_id: Uuid
  monto: number
  estado: EstadoObligacion
  created_at: IsoDateTime
}

export type EstadoComprobante = "pendiente" | "aceptado" | "rechazado"

export interface Comprobante {
  id: Uuid
  usuario_id: Uuid
  archivo_url: string | null
  monto_total: number
  canal: "manual" | "wompi" | "whatsapp"
  fecha_carga: IsoDateTime
  estado: EstadoComprobante
  motivo_rechazo: string | null
  revisado_por: Uuid | null
  revisado_en: IsoDateTime | null
}

export interface PagoAplicado {
  id: Uuid
  comprobante_id: Uuid
  obligacion_id: Uuid | null // null = saldo a favor sin asignar
  monto_aplicado: number
  regla_aplicada: Uuid | null // null = ajuste manual del tesorero
}

export interface SaldoAFavor {
  id: Uuid
  usuario_id: Uuid
  monto: number
  origen_comprobante_id: Uuid | null // null = originado por cancelación de evento
  consumido: boolean
  consumido_en_obligacion_id: Uuid | null
  created_at: IsoDateTime
}

export type TipoRegla = "monto_exacto" | "evento_especifico" | "mas_antiguo_primero"

export interface ReglaConciliacion {
  id: Uuid
  club_id: Uuid
  nombre: string
  tipo: TipoRegla
  condicion: Record<string, unknown>
  accion: Record<string, unknown>
  prioridad: number
  activa: boolean
  creado_por: Uuid | null
  created_at: IsoDateTime
  updated_at: IsoDateTime
}

export interface Conciliacion {
  id: Uuid
  club_id: Uuid
  mes: IsoDate // primer día del mes
  saldo_inicial: number
  saldo_final: number
  total_aceptado: number
  total_egresos: number
  diferencia: number
  notas: string | null
  creado_por: Uuid
  created_at: IsoDateTime
}

export type CategoriaEgreso = "arriendo_cancha" | "arbitros" | "equipamiento" | "federacion" | "otro"

export interface Egreso {
  id: Uuid
  club_id: Uuid
  fecha: IsoDate
  monto: number
  concepto: string
  categoria: CategoriaEgreso
  creado_por: Uuid
  anulado_en: IsoDateTime | null
  created_at: IsoDateTime
}

/** Cuánto paga al mes un jugador lesionado o inactivo (activo usa el monto de la mensualidad; retirado es 0). */
export interface TarifaEstado {
  club_id: Uuid
  estado: "lesionado" | "inactivo"
  monto_mensual: number
  updated_at: IsoDateTime
}

// Enum cerrado — agregar un valor es una decisión deliberada (docs/02-data-model.md).
export const TIPOS_BITACORA = [
  "evento_cobro_creado",
  "evento_cobro_cancelado",
  "jugador_creado",
  "jugador_estado_cambiado",
  "comprobante_subido",
  "comprobante_aceptado",
  "comprobante_rechazado",
  "conciliacion_guardada",
  "regla_conciliacion_cambiada",
  "egreso_registrado",
  "egreso_anulado",
  "tarifa_cambiada",
  "obligacion_condonada",
] as const
export type TipoBitacora = (typeof TIPOS_BITACORA)[number]

export interface Bitacora {
  id: Uuid
  club_id: Uuid
  tipo: TipoBitacora
  actor_id: Uuid | null
  objetivo_tipo: "usuario" | "evento_cobro" | "comprobante" | "conciliacion" | "regla" | "egreso" | "club" | "obligacion"
  objetivo_id: Uuid
  descripcion: string
  metadata: Record<string, unknown>
  created_at: IsoDateTime
}

/** Snapshot completo de la base. En Supabase cada clave es una tabla. */
export interface Db {
  clubes: Club[]
  usuarios: Usuario[]
  roles_usuario: RolUsuario[]
  eventos_cobro: EventoCobro[]
  obligaciones: Obligacion[]
  comprobantes: Comprobante[]
  pagos_aplicados: PagoAplicado[]
  saldo_a_favor: SaldoAFavor[]
  reglas_conciliacion: ReglaConciliacion[]
  conciliaciones: Conciliacion[]
  egresos: Egreso[]
  tarifas_estado: TarifaEstado[]
  bitacora: Bitacora[]
}

export type TableName = keyof Db

/**
 * Contrato de persistencia. `JsonStore` lo implementa hoy; un `SupabaseStore`
 * lo implementará después sin tocar dominio ni UI.
 *
 * `read` da una vista de solo lectura; `transaction` serializa las escrituras
 * (en Postgres será una transacción real / RPC).
 */
export interface Store {
  read(): Promise<Readonly<Db>>
  transaction<T>(fn: (db: Db) => T | Promise<T>): Promise<T>
  reset(db: Db): Promise<void>
}
