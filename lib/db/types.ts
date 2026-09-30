import type { Enums, Tables } from "@/lib/data/database.types"

// Alias legibles sobre los tipos generados del esquema de Supabase.
export type Rol = Enums<"rol">
export type EstadoMiembro = Enums<"estado_miembro">
export type TipoCobro = Enums<"tipo_cobro">
export type AlcanceCobro = Enums<"alcance_cobro">
export type TipoBitacora = Enums<"tipo_bitacora">
export type Miembro = Tables<"miembros">
export type EventoCobro = Tables<"eventos_cobro">
export type Obligacion = Tables<"obligaciones">
export type Comprobante = Tables<"comprobantes">
export type ReglaConciliacion = Tables<"reglas_conciliacion">
export type Conciliacion = Tables<"conciliaciones">

export type EstadoCuenta = "al_dia" | "pendiente" | "mora"

export const TIPOS_BITACORA: readonly TipoBitacora[] = [
  "evento_cobro_creado",
  "evento_cobro_cancelado",
  "jugador_creado",
  "jugador_estado_cambiado",
  "comprobante_subido",
  "comprobante_aceptado",
  "comprobante_rechazado",
  "conciliacion_guardada",
  "regla_conciliacion_cambiada",
]

export const TIPO_COBRO_LABEL: Record<TipoCobro, string> = {
  mensualidad: "Mensualidad",
  afiliacion: "Afiliación",
  torneo: "Torneo",
  uniforme: "Uniforme",
  otro: "Otro",
}
