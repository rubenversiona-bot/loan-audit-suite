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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bank_amortization_rows: {
        Row: {
          balance: number | null
          created_at: string
          document_id: string
          due_date: string | null
          id: string
          interest: number | null
          loan_id: string
          owner_id: string
          payment: number | null
          period: number
          principal: number | null
          rate: number | null
        }
        Insert: {
          balance?: number | null
          created_at?: string
          document_id: string
          due_date?: string | null
          id?: string
          interest?: number | null
          loan_id: string
          owner_id: string
          payment?: number | null
          period: number
          principal?: number | null
          rate?: number | null
        }
        Update: {
          balance?: number | null
          created_at?: string
          document_id?: string
          due_date?: string | null
          id?: string
          interest?: number | null
          loan_id?: string
          owner_id?: string
          payment?: number | null
          period?: number
          principal?: number | null
          rate?: number | null
        }
        Relationships: []
      }
      bank_statements: {
        Row: {
          file_path: string | null
          id: string
          imported_at: string
          loan_id: string
          owner_id: string
          period_end: string | null
          period_start: string | null
          source_format: string | null
        }
        Insert: {
          file_path?: string | null
          id?: string
          imported_at?: string
          loan_id: string
          owner_id: string
          period_end?: string | null
          period_start?: string | null
          source_format?: string | null
        }
        Update: {
          file_path?: string | null
          id?: string
          imported_at?: string
          loan_id?: string
          owner_id?: string
          period_end?: string | null
          period_start?: string | null
          source_format?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_statements_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      discrepancies: {
        Row: {
          actual_amount: number | null
          category: Database["public"]["Enums"]["discrepancy_category"]
          created_at: string
          delta: number
          description: string | null
          discrepancy_date: string
          id: string
          in_favor_of: string | null
          loan_id: string
          owner_id: string
          theoretical_amount: number | null
        }
        Insert: {
          actual_amount?: number | null
          category: Database["public"]["Enums"]["discrepancy_category"]
          created_at?: string
          delta: number
          description?: string | null
          discrepancy_date: string
          id?: string
          in_favor_of?: string | null
          loan_id: string
          owner_id: string
          theoretical_amount?: number | null
        }
        Update: {
          actual_amount?: number | null
          category?: Database["public"]["Enums"]["discrepancy_category"]
          created_at?: string
          delta?: number
          description?: string | null
          discrepancy_date?: string
          id?: string
          in_favor_of?: string | null
          loan_id?: string
          owner_id?: string
          theoretical_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "discrepancies_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          bucket: string
          created_at: string
          doc_type: string | null
          file_name: string | null
          file_path: string
          id: string
          loan_id: string | null
          owner_id: string
          size_bytes: number | null
        }
        Insert: {
          bucket: string
          created_at?: string
          doc_type?: string | null
          file_name?: string | null
          file_path: string
          id?: string
          loan_id?: string | null
          owner_id: string
          size_bytes?: number | null
        }
        Update: {
          bucket?: string
          created_at?: string
          doc_type?: string | null
          file_name?: string | null
          file_path?: string
          id?: string
          loan_id?: string | null
          owner_id?: string
          size_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      index_values: {
        Row: {
          created_at: string
          id: string
          index_id: string
          source: Database["public"]["Enums"]["index_source"]
          synced_at: string | null
          value: number
          value_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          index_id: string
          source?: Database["public"]["Enums"]["index_source"]
          synced_at?: string | null
          value: number
          value_date: string
        }
        Update: {
          created_at?: string
          id?: string
          index_id?: string
          source?: Database["public"]["Enums"]["index_source"]
          synced_at?: string | null
          value?: number
          value_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "index_values_index_id_fkey"
            columns: ["index_id"]
            isOneToOne: false
            referencedRelation: "reference_indexes"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_events: {
        Row: {
          amount: number | null
          created_at: string
          description: string | null
          event_date: string
          event_type: Database["public"]["Enums"]["loan_event_type"]
          id: string
          loan_id: string
          metadata: Json | null
          new_rate: number | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          description?: string | null
          event_date: string
          event_type: Database["public"]["Enums"]["loan_event_type"]
          id?: string
          loan_id: string
          metadata?: Json | null
          new_rate?: number | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          description?: string | null
          event_date?: string
          event_type?: Database["public"]["Enums"]["loan_event_type"]
          id?: string
          loan_id?: string
          metadata?: Json | null
          new_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_events_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          amort_system: Database["public"]["Enums"]["amort_system"]
          bank_name: string | null
          cancellation_fee_pct: number | null
          ceiling_rate: number | null
          created_at: string
          day_count_basis: string
          debtor_name: string
          early_repay_fee_pct: number | null
          expediente_date: string | null
          expediente_ref: string | null
          fixed_period_months: number | null
          floor_rate: number | null
          id: string
          index_id: string | null
          index_lookback_months: number
          initial_capital: number
          initial_tin: number | null
          loan_number: string | null
          notes: string | null
          opening_fee_pct: number | null
          owner_id: string
          payment_frequency_months: number
          rate_type: Database["public"]["Enums"]["rate_type"]
          review_period_months: number | null
          signed_date: string
          spread: number | null
          status: string
          term_months: number
          updated_at: string
        }
        Insert: {
          amort_system?: Database["public"]["Enums"]["amort_system"]
          bank_name?: string | null
          cancellation_fee_pct?: number | null
          ceiling_rate?: number | null
          created_at?: string
          day_count_basis?: string
          debtor_name: string
          early_repay_fee_pct?: number | null
          expediente_date?: string | null
          expediente_ref?: string | null
          fixed_period_months?: number | null
          floor_rate?: number | null
          id?: string
          index_id?: string | null
          index_lookback_months?: number
          initial_capital: number
          initial_tin?: number | null
          loan_number?: string | null
          notes?: string | null
          opening_fee_pct?: number | null
          owner_id: string
          payment_frequency_months?: number
          rate_type?: Database["public"]["Enums"]["rate_type"]
          review_period_months?: number | null
          signed_date: string
          spread?: number | null
          status?: string
          term_months: number
          updated_at?: string
        }
        Update: {
          amort_system?: Database["public"]["Enums"]["amort_system"]
          bank_name?: string | null
          cancellation_fee_pct?: number | null
          ceiling_rate?: number | null
          created_at?: string
          day_count_basis?: string
          debtor_name?: string
          early_repay_fee_pct?: number | null
          expediente_date?: string | null
          expediente_ref?: string | null
          fixed_period_months?: number | null
          floor_rate?: number | null
          id?: string
          index_id?: string | null
          index_lookback_months?: number
          initial_capital?: number
          initial_tin?: number | null
          loan_number?: string | null
          notes?: string | null
          opening_fee_pct?: number | null
          owner_id?: string
          payment_frequency_months?: number
          rate_type?: Database["public"]["Enums"]["rate_type"]
          review_period_months?: number | null
          signed_date?: string
          spread?: number | null
          status?: string
          term_months?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_index_id_fkey"
            columns: ["index_id"]
            isOneToOne: false
            referencedRelation: "reference_indexes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          colegiado: string | null
          created_at: string
          despacho: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          colegiado?: string | null
          created_at?: string
          despacho?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          colegiado?: string | null
          created_at?: string
          despacho?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      reference_indexes: {
        Row: {
          bde_dataset: string | null
          bde_series_code: string | null
          code: string
          created_at: string
          description: string | null
          id: string
          is_official: boolean
          name: string
        }
        Insert: {
          bde_dataset?: string | null
          bde_series_code?: string | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_official?: boolean
          name: string
        }
        Update: {
          bde_dataset?: string | null
          bde_series_code?: string | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_official?: boolean
          name?: string
        }
        Relationships: []
      }
      statement_movements: {
        Row: {
          amount: number
          balance: number | null
          created_at: string
          description: string | null
          id: string
          matched_event_id: string | null
          movement_date: string
          statement_id: string
        }
        Insert: {
          amount: number
          balance?: number | null
          created_at?: string
          description?: string | null
          id?: string
          matched_event_id?: string | null
          movement_date: string
          statement_id: string
        }
        Update: {
          amount?: number
          balance?: number | null
          created_at?: string
          description?: string | null
          id?: string
          matched_event_id?: string | null
          movement_date?: string
          statement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "statement_movements_matched_event_id_fkey"
            columns: ["matched_event_id"]
            isOneToOne: false
            referencedRelation: "loan_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statement_movements_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "bank_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      amort_system: "frances" | "aleman"
      app_role: "admin" | "perito" | "user"
      discrepancy_category:
        | "interes_excedente"
        | "comision_indebida"
        | "capital_mal_aplicado"
        | "irph_vs_euribor"
        | "clausula_suelo"
        | "otro"
      index_source: "manual" | "csv" | "bde_api"
      loan_event_type:
        | "pago_programado"
        | "amortizacion_anticipada"
        | "cambio_tasa"
        | "comision"
        | "mora"
        | "novacion"
      rate_type: "fijo" | "variable" | "mixto"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      amort_system: ["frances", "aleman"],
      app_role: ["admin", "perito", "user"],
      discrepancy_category: [
        "interes_excedente",
        "comision_indebida",
        "capital_mal_aplicado",
        "irph_vs_euribor",
        "clausula_suelo",
        "otro",
      ],
      index_source: ["manual", "csv", "bde_api"],
      loan_event_type: [
        "pago_programado",
        "amortizacion_anticipada",
        "cambio_tasa",
        "comision",
        "mora",
        "novacion",
      ],
      rate_type: ["fijo", "variable", "mixto"],
    },
  },
} as const
