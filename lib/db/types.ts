import type { Enums, Tables } from "@/lib/data/database.types"

// Alias legibles sobre los tipos generados del esquema de Supabase.
export type Rol = Enums<"rol">
export type EstadoMiembro = Enums<"estado_miembro">
export type TipoCobro = Enums<"tipo_cobro">
export type AlcanceCobro = Enums<"alcance_cobro">
export type TipoBitacora = Enums<"tipo_bitacora">
export type CategoriaEgreso = Enums<"categoria_egreso">
export type Miembro = Tables<"miembros">
export type EventoCobro = Tables<"eventos_cobro">
export type Obligacion = Tables<"obligaciones">
export type Comprobante = Tables<"comprobantes">
export type ReglaConciliacion = Tables<"reglas_conciliacion">
export type Conciliacion = Tables<"conciliaciones">
export type Egreso = Tables<"egresos">
export type EstadoAcuerdo = Enums<"estado_acuerdo">
export type AcuerdoPago = Tables<"acuerdos_pago">
export type CuotaAcuerdo = Tables<"cuotas_acuerdo">
export type TipoRecordatorio = Enums<"tipo_recordatorio">
export type ReglaRecordatorio = Tables<"reglas_recordatorio">

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
  "egreso_registrado",
  "egreso_anulado",
  "acuerdo_pago_cambiado",
  "cruce_registrado",
]

export const TIPO_COBRO_LABEL: Record<TipoCobro, string> = {
  mensualidad: "Mensualidad",
  afiliacion: "Afiliación",
  torneo: "Torneo",
  uniforme: "Uniforme",
  otro: "Otro",
}

export const CATEGORIA_EGRESO_LABEL: Record<CategoriaEgreso, string> = {
  canchas: "Canchas",
  nomina: "Nómina",
  uniformes: "Uniformes",
  torneos: "Torneos",
  administrativos: "Gastos administrativos",
  polizas: "Pólizas",
  liga_federacion: "Liga/Federación",
  otros: "Otros",
}
