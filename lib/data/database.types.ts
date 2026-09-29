// Generado desde Supabase (MCP generate_typescript_types). No editar a mano: regenerar tras cada migración.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      aplicaciones: {
        Row: {
          anulada_en: string | null
          anulada_motivo: string | null
          club_id: string
          comprobante_id: string
          creado_por: string | null
          created_at: string
          id: string
          monto: number
          obligacion_id: string
          origen: Database["public"]["Enums"]["origen_aplicacion"]
          regla_id: string | null
        }
        Insert: {
          anulada_en?: string | null
          anulada_motivo?: string | null
          club_id: string
          comprobante_id: string
          creado_por?: string | null
          created_at?: string
          id?: string
          monto: number
          obligacion_id: string
          origen: Database["public"]["Enums"]["origen_aplicacion"]
          regla_id?: string | null
        }
        Update: {
          anulada_en?: string | null
          anulada_motivo?: string | null
          club_id?: string
          comprobante_id?: string
          creado_por?: string | null
          created_at?: string
          id?: string
          monto?: number
          obligacion_id?: string
          origen?: Database["public"]["Enums"]["origen_aplicacion"]
          regla_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aplicaciones_club_id_comprobante_id_fkey"
            columns: ["club_id", "comprobante_id"]
            isOneToOne: false
            referencedRelation: "comprobantes"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "aplicaciones_club_id_creado_por_fkey"
            columns: ["club_id", "creado_por"]
            isOneToOne: false
            referencedRelation: "estado_cuenta_miembros"
            referencedColumns: ["club_id", "miembro_id"]
          },
          {
            foreignKeyName: "aplicaciones_club_id_creado_por_fkey"
            columns: ["club_id", "creado_por"]
            isOneToOne: false
            referencedRelation: "miembros"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "aplicaciones_club_id_obligacion_id_fkey"
            columns: ["club_id", "obligacion_id"]
            isOneToOne: false
            referencedRelation: "obligaciones"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "aplicaciones_club_id_regla_id_fkey"
            columns: ["club_id", "regla_id"]
            isOneToOne: false
            referencedRelation: "reglas_conciliacion"
            referencedColumns: ["club_id", "id"]
          },
        ]
      }
      bitacora: {
        Row: {
          actor_id: string | null
          club_id: string
          created_at: string
          descripcion: string
          id: number
          metadata: Json
          objetivo_id: string
          objetivo_tipo: Database["public"]["Enums"]["objetivo_bitacora"]
          tipo: Database["public"]["Enums"]["tipo_bitacora"]
        }
        Insert: {
          actor_id?: string | null
          club_id: string
          created_at?: string
          descripcion: string
          id?: never
          metadata?: Json
          objetivo_id: string
          objetivo_tipo: Database["public"]["Enums"]["objetivo_bitacora"]
          tipo: Database["public"]["Enums"]["tipo_bitacora"]
        }
        Update: {
          actor_id?: string | null
          club_id?: string
          created_at?: string
          descripcion?: string
          id?: never
          metadata?: Json
          objetivo_id?: string
          objetivo_tipo?: Database["public"]["Enums"]["objetivo_bitacora"]
          tipo?: Database["public"]["Enums"]["tipo_bitacora"]
        }
        Relationships: [
          {
            foreignKeyName: "bitacora_club_id_actor_id_fkey"
            columns: ["club_id", "actor_id"]
            isOneToOne: false
            referencedRelation: "estado_cuenta_miembros"
            referencedColumns: ["club_id", "miembro_id"]
          },
          {
            foreignKeyName: "bitacora_club_id_actor_id_fkey"
            columns: ["club_id", "actor_id"]
            isOneToOne: false
            referencedRelation: "miembros"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "bitacora_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id"]
          },
        ]
      }
      clubes: {
        Row: {
          categorias: string[]
          created_at: string
          id: string
          moneda: string
          nombre: string
          updated_at: string
          zona_horaria: string
        }
        Insert: {
          categorias?: string[]
          created_at?: string
          id?: string
          moneda?: string
          nombre: string
          updated_at?: string
          zona_horaria?: string
        }
        Update: {
          categorias?: string[]
          created_at?: string
          id?: string
          moneda?: string
          nombre?: string
          updated_at?: string
          zona_horaria?: string
        }
        Relationships: []
      }
      comprobantes: {
        Row: {
          archivo_path: string | null
          canal: Database["public"]["Enums"]["canal_comprobante"]
          club_id: string
          created_at: string
          estado: Database["public"]["Enums"]["estado_comprobante"]
          extraccion: Json | null
          fecha_pago: string
          id: string
          miembro_id: string
          monto: number
          motivo_rechazo: string | null
          origen_ref: string | null
          revisado_en: string | null
          revisado_por: string | null
        }
        Insert: {
          archivo_path?: string | null
          canal?: Database["public"]["Enums"]["canal_comprobante"]
          club_id: string
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_comprobante"]
          extraccion?: Json | null
          fecha_pago?: string
          id?: string
          miembro_id: string
          monto: number
          motivo_rechazo?: string | null
          origen_ref?: string | null
          revisado_en?: string | null
          revisado_por?: string | null
        }
        Update: {
          archivo_path?: string | null
          canal?: Database["public"]["Enums"]["canal_comprobante"]
          club_id?: string
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_comprobante"]
          extraccion?: Json | null
          fecha_pago?: string
          id?: string
          miembro_id?: string
          monto?: number
          motivo_rechazo?: string | null
          origen_ref?: string | null
          revisado_en?: string | null
          revisado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comprobantes_club_id_miembro_id_fkey"
            columns: ["club_id", "miembro_id"]
            isOneToOne: false
            referencedRelation: "estado_cuenta_miembros"
            referencedColumns: ["club_id", "miembro_id"]
          },
          {
            foreignKeyName: "comprobantes_club_id_miembro_id_fkey"
            columns: ["club_id", "miembro_id"]
            isOneToOne: false
            referencedRelation: "miembros"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "comprobantes_club_id_revisado_por_fkey"
            columns: ["club_id", "revisado_por"]
            isOneToOne: false
            referencedRelation: "estado_cuenta_miembros"
            referencedColumns: ["club_id", "miembro_id"]
          },
          {
            foreignKeyName: "comprobantes_club_id_revisado_por_fkey"
            columns: ["club_id", "revisado_por"]
            isOneToOne: false
            referencedRelation: "miembros"
            referencedColumns: ["club_id", "id"]
          },
        ]
      }
      conciliaciones: {
        Row: {
          club_id: string
          creado_por: string | null
          created_at: string
          diferencia: number | null
          id: string
          mes: string
          notas: string | null
          saldo_final: number
          saldo_inicial: number
          total_aceptado: number
          updated_at: string
        }
        Insert: {
          club_id: string
          creado_por?: string | null
          created_at?: string
          diferencia?: number | null
          id?: string
          mes: string
          notas?: string | null
          saldo_final: number
          saldo_inicial: number
          total_aceptado?: number
          updated_at?: string
        }
        Update: {
          club_id?: string
          creado_por?: string | null
          created_at?: string
          diferencia?: number | null
          id?: string
          mes?: string
          notas?: string | null
          saldo_final?: number
          saldo_inicial?: number
          total_aceptado?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conciliaciones_club_id_creado_por_fkey"
            columns: ["club_id", "creado_por"]
            isOneToOne: false
            referencedRelation: "estado_cuenta_miembros"
            referencedColumns: ["club_id", "miembro_id"]
          },
          {
            foreignKeyName: "conciliaciones_club_id_creado_por_fkey"
            columns: ["club_id", "creado_por"]
            isOneToOne: false
            referencedRelation: "miembros"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "conciliaciones_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_cobro: {
        Row: {
          alcance: Database["public"]["Enums"]["alcance_cobro"]
          cancelado_en: string | null
          categoria: string | null
          club_id: string
          creado_por: string | null
          created_at: string
          estado: Database["public"]["Enums"]["estado_evento"]
          fecha_limite: string
          id: string
          monto: number
          nombre: string
          tipo: Database["public"]["Enums"]["tipo_cobro"]
          updated_at: string
        }
        Insert: {
          alcance: Database["public"]["Enums"]["alcance_cobro"]
          cancelado_en?: string | null
          categoria?: string | null
          club_id: string
          creado_por?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_evento"]
          fecha_limite: string
          id?: string
          monto: number
          nombre: string
          tipo?: Database["public"]["Enums"]["tipo_cobro"]
          updated_at?: string
        }
        Update: {
          alcance?: Database["public"]["Enums"]["alcance_cobro"]
          cancelado_en?: string | null
          categoria?: string | null
          club_id?: string
          creado_por?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_evento"]
          fecha_limite?: string
          id?: string
          monto?: number
          nombre?: string
          tipo?: Database["public"]["Enums"]["tipo_cobro"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_cobro_club_id_creado_por_fkey"
            columns: ["club_id", "creado_por"]
            isOneToOne: false
            referencedRelation: "estado_cuenta_miembros"
            referencedColumns: ["club_id", "miembro_id"]
          },
          {
            foreignKeyName: "eventos_cobro_club_id_creado_por_fkey"
            columns: ["club_id", "creado_por"]
            isOneToOne: false
            referencedRelation: "miembros"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "eventos_cobro_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id"]
          },
        ]
      }
      miembros: {
        Row: {
          auth_user_id: string | null
          categoria: string | null
          club_id: string
          correo: string
          created_at: string
          estado: Database["public"]["Enums"]["estado_miembro"]
          id: string
          nombre: string
          roles: Database["public"]["Enums"]["rol"][]
          telefono: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          categoria?: string | null
          club_id: string
          correo: string
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_miembro"]
          id?: string
          nombre: string
          roles?: Database["public"]["Enums"]["rol"][]
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          categoria?: string | null
          club_id?: string
          correo?: string
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_miembro"]
          id?: string
          nombre?: string
          roles?: Database["public"]["Enums"]["rol"][]
          telefono?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "miembros_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id"]
          },
        ]
      }
      obligaciones: {
        Row: {
          club_id: string
          created_at: string
          estado: string | null
          evento_id: string
          id: string
          miembro_id: string
          monto: number
          pagado: number
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          estado?: string | null
          evento_id: string
          id?: string
          miembro_id: string
          monto: number
          pagado?: number
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          estado?: string | null
          evento_id?: string
          id?: string
          miembro_id?: string
          monto?: number
          pagado?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obligaciones_club_id_evento_id_fkey"
            columns: ["club_id", "evento_id"]
            isOneToOne: false
            referencedRelation: "eventos_cobro"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "obligaciones_club_id_evento_id_fkey"
            columns: ["club_id", "evento_id"]
            isOneToOne: false
            referencedRelation: "progreso_eventos"
            referencedColumns: ["club_id", "evento_id"]
          },
          {
            foreignKeyName: "obligaciones_club_id_miembro_id_fkey"
            columns: ["club_id", "miembro_id"]
            isOneToOne: false
            referencedRelation: "estado_cuenta_miembros"
            referencedColumns: ["club_id", "miembro_id"]
          },
          {
            foreignKeyName: "obligaciones_club_id_miembro_id_fkey"
            columns: ["club_id", "miembro_id"]
            isOneToOne: false
            referencedRelation: "miembros"
            referencedColumns: ["club_id", "id"]
          },
        ]
      }
      reglas_conciliacion: {
        Row: {
          activa: boolean
          club_id: string
          creado_por: string | null
          created_at: string
          id: string
          nombre: string
          parametros: Json
          prioridad: number
          tipo: Database["public"]["Enums"]["tipo_regla"]
          updated_at: string
        }
        Insert: {
          activa?: boolean
          club_id: string
          creado_por?: string | null
          created_at?: string
          id?: string
          nombre: string
          parametros?: Json
          prioridad: number
          tipo: Database["public"]["Enums"]["tipo_regla"]
          updated_at?: string
        }
        Update: {
          activa?: boolean
          club_id?: string
          creado_por?: string | null
          created_at?: string
          id?: string
          nombre?: string
          parametros?: Json
          prioridad?: number
          tipo?: Database["public"]["Enums"]["tipo_regla"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reglas_conciliacion_club_id_creado_por_fkey"
            columns: ["club_id", "creado_por"]
            isOneToOne: false
            referencedRelation: "estado_cuenta_miembros"
            referencedColumns: ["club_id", "miembro_id"]
          },
          {
            foreignKeyName: "reglas_conciliacion_club_id_creado_por_fkey"
            columns: ["club_id", "creado_por"]
            isOneToOne: false
            referencedRelation: "miembros"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "reglas_conciliacion_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      estado_cuenta_miembros: {
        Row: {
          club_id: string | null
          estado_cuenta: string | null
          miembro_id: string | null
          proximo_vencimiento: string | null
          saldo_a_favor: number | null
          total_pendiente: number | null
          total_vencido: number | null
        }
        Relationships: [
          {
            foreignKeyName: "miembros_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id"]
          },
        ]
      }
      progreso_eventos: {
        Row: {
          club_id: string | null
          evento_id: string | null
          monto_total: number | null
          pagadas: number | null
          recaudado: number | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_cobro_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      aceptar_comprobante: {
        Args: { p_comprobante_id: string; p_lineas: Json }
        Returns: undefined
      }
      agregar_regla_evento: {
        Args: { p_club_id: string; p_evento_id: string }
        Returns: string
      }
      cambiar_estado_miembro: {
        Args: {
          p_estado: Database["public"]["Enums"]["estado_miembro"]
          p_miembro_id: string
        }
        Returns: undefined
      }
      cancelar_evento: { Args: { p_evento_id: string }; Returns: number }
      crear_evento: {
        Args: {
          p_alcance: Database["public"]["Enums"]["alcance_cobro"]
          p_categoria?: string
          p_club_id: string
          p_fecha_limite: string
          p_miembro_ids?: string[]
          p_monto: number
          p_nombre: string
          p_tipo: Database["public"]["Enums"]["tipo_cobro"]
        }
        Returns: string
      }
      guardar_conciliacion: {
        Args: {
          p_club_id: string
          p_mes: string
          p_notas?: string
          p_saldo_final: number
          p_saldo_inicial: number
        }
        Returns: {
          club_id: string
          creado_por: string | null
          created_at: string
          diferencia: number | null
          id: string
          mes: string
          notas: string | null
          saldo_final: number
          saldo_inicial: number
          total_aceptado: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "conciliaciones"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reordenar_reglas: {
        Args: { p_club_id: string; p_ids: string[] }
        Returns: undefined
      }
    }
    Enums: {
      alcance_cobro: "todos" | "grupo" | "individual"
      canal_comprobante: "manual" | "whatsapp" | "wompi"
      estado_comprobante: "pendiente" | "aceptado" | "rechazado"
      estado_evento: "activo" | "cancelado"
      estado_miembro: "activo" | "lesionado" | "retirado"
      objetivo_bitacora:
        | "miembro"
        | "evento_cobro"
        | "comprobante"
        | "conciliacion"
        | "regla"
      origen_aplicacion: "propuesta" | "manual" | "saldo_a_favor"
      rol: "administrativo" | "tesorero" | "jugador"
      tipo_bitacora:
        | "evento_cobro_creado"
        | "evento_cobro_cancelado"
        | "jugador_creado"
        | "jugador_estado_cambiado"
        | "comprobante_subido"
        | "comprobante_aceptado"
        | "comprobante_rechazado"
        | "conciliacion_guardada"
        | "regla_conciliacion_cambiada"
      tipo_cobro: "mensualidad" | "afiliacion" | "torneo" | "uniforme" | "otro"
      tipo_regla: "monto_exacto" | "evento_especifico" | "mas_antiguo_primero"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      alcance_cobro: ["todos", "grupo", "individual"],
      canal_comprobante: ["manual", "whatsapp", "wompi"],
      estado_comprobante: ["pendiente", "aceptado", "rechazado"],
      estado_evento: ["activo", "cancelado"],
      estado_miembro: ["activo", "lesionado", "retirado"],
      objetivo_bitacora: [
        "miembro",
        "evento_cobro",
        "comprobante",
        "conciliacion",
        "regla",
      ],
      origen_aplicacion: ["propuesta", "manual", "saldo_a_favor"],
      rol: ["administrativo", "tesorero", "jugador"],
      tipo_bitacora: [
        "evento_cobro_creado",
        "evento_cobro_cancelado",
        "jugador_creado",
        "jugador_estado_cambiado",
        "comprobante_subido",
        "comprobante_aceptado",
        "comprobante_rechazado",
        "conciliacion_guardada",
        "regla_conciliacion_cambiada",
      ],
      tipo_cobro: ["mensualidad", "afiliacion", "torneo", "uniforme", "otro"],
      tipo_regla: ["monto_exacto", "evento_especifico", "mas_antiguo_primero"],
    },
  },
} as const
