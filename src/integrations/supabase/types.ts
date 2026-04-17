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
      aviso_gestor: {
        Row: {
          ativo: boolean
          created_at: string
          criado_por: string | null
          expira_em: string | null
          id: string
          mensagem: string
          tipo: Database["public"]["Enums"]["aviso_tipo"]
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          expira_em?: string | null
          id?: string
          mensagem: string
          tipo?: Database["public"]["Enums"]["aviso_tipo"]
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          expira_em?: string | null
          id?: string
          mensagem?: string
          tipo?: Database["public"]["Enums"]["aviso_tipo"]
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      colaborador: {
        Row: {
          ativo: boolean
          bio: string | null
          cargo: string | null
          created_at: string
          email: string | null
          foto_url: string | null
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bio?: string | null
          cargo?: string | null
          created_at?: string
          email?: string | null
          foto_url?: string | null
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bio?: string | null
          cargo?: string | null
          created_at?: string
          email?: string | null
          foto_url?: string | null
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      demanda: {
        Row: {
          categoria: Database["public"]["Enums"]["demanda_categoria"]
          created_at: string
          criado_por: string | null
          descricao: string | null
          id: string
          origem: Database["public"]["Enums"]["demanda_origem"]
          prazo: string | null
          prioridade: Database["public"]["Enums"]["demanda_prioridade"]
          responsavel_id: string | null
          solicitante: string | null
          status: Database["public"]["Enums"]["demanda_status"]
          tags: string[] | null
          titulo: string
          updated_at: string
        }
        Insert: {
          categoria?: Database["public"]["Enums"]["demanda_categoria"]
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          origem?: Database["public"]["Enums"]["demanda_origem"]
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["demanda_prioridade"]
          responsavel_id?: string | null
          solicitante?: string | null
          status?: Database["public"]["Enums"]["demanda_status"]
          tags?: string[] | null
          titulo: string
          updated_at?: string
        }
        Update: {
          categoria?: Database["public"]["Enums"]["demanda_categoria"]
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          origem?: Database["public"]["Enums"]["demanda_origem"]
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["demanda_prioridade"]
          responsavel_id?: string | null
          solicitante?: string | null
          status?: Database["public"]["Enums"]["demanda_status"]
          tags?: string[] | null
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cargo: string | null
          created_at: string
          email: string
          id: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          email: string
          id?: string
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          email?: string
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reuniao: {
        Row: {
          audio_mime: string | null
          audio_path: string | null
          audio_size: number | null
          created_at: string
          criado_por: string | null
          data_reuniao: string
          duracao_min: number | null
          id: string
          link_calendario: string | null
          participantes: string[] | null
          pauta: string | null
          proximos_passos: string | null
          responsavel_id: string | null
          resumo: string | null
          status: Database["public"]["Enums"]["reuniao_status"]
          tipo: Database["public"]["Enums"]["reuniao_tipo"]
          titulo: string
          transcricao: string | null
          updated_at: string
        }
        Insert: {
          audio_mime?: string | null
          audio_path?: string | null
          audio_size?: number | null
          created_at?: string
          criado_por?: string | null
          data_reuniao: string
          duracao_min?: number | null
          id?: string
          link_calendario?: string | null
          participantes?: string[] | null
          pauta?: string | null
          proximos_passos?: string | null
          responsavel_id?: string | null
          resumo?: string | null
          status?: Database["public"]["Enums"]["reuniao_status"]
          tipo?: Database["public"]["Enums"]["reuniao_tipo"]
          titulo: string
          transcricao?: string | null
          updated_at?: string
        }
        Update: {
          audio_mime?: string | null
          audio_path?: string | null
          audio_size?: number | null
          created_at?: string
          criado_por?: string | null
          data_reuniao?: string
          duracao_min?: number | null
          id?: string
          link_calendario?: string | null
          participantes?: string[] | null
          pauta?: string | null
          proximos_passos?: string | null
          responsavel_id?: string | null
          resumo?: string | null
          status?: Database["public"]["Enums"]["reuniao_status"]
          tipo?: Database["public"]["Enums"]["reuniao_tipo"]
          titulo?: string
          transcricao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      todo: {
        Row: {
          concluida_em: string | null
          created_at: string
          criado_por: string | null
          data_prevista: string | null
          demanda_id: string | null
          descricao: string | null
          id: string
          prioridade: Database["public"]["Enums"]["todo_prioridade"]
          responsavel_id: string | null
          status: Database["public"]["Enums"]["todo_status"]
          titulo: string
          updated_at: string
        }
        Insert: {
          concluida_em?: string | null
          created_at?: string
          criado_por?: string | null
          data_prevista?: string | null
          demanda_id?: string | null
          descricao?: string | null
          id?: string
          prioridade?: Database["public"]["Enums"]["todo_prioridade"]
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["todo_status"]
          titulo: string
          updated_at?: string
        }
        Update: {
          concluida_em?: string | null
          created_at?: string
          criado_por?: string | null
          data_prevista?: string | null
          demanda_id?: string | null
          descricao?: string | null
          id?: string
          prioridade?: Database["public"]["Enums"]["todo_prioridade"]
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["todo_status"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demanda"
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
      app_role: "gestor" | "analista"
      aviso_tipo: "informativo" | "alerta" | "critico"
      demanda_categoria:
        | "bug"
        | "melhoria"
        | "nova_funcionalidade"
        | "duvida"
        | "documentacao"
        | "outro"
      demanda_origem: "email" | "reuniao" | "chamado" | "whatsapp" | "outro"
      demanda_prioridade: "baixa" | "media" | "alta" | "critica"
      demanda_status:
        | "aberta"
        | "em_analise"
        | "em_andamento"
        | "aguardando_cliente"
        | "homologacao"
        | "concluida"
        | "cancelada"
      reuniao_status: "agendada" | "realizada" | "cancelada"
      reuniao_tipo:
        | "interna"
        | "cliente"
        | "fornecedor"
        | "alinhamento"
        | "outro"
      todo_prioridade: "baixa" | "media" | "alta"
      todo_status: "pendente" | "em_andamento" | "concluida" | "cancelada"
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
      app_role: ["gestor", "analista"],
      aviso_tipo: ["informativo", "alerta", "critico"],
      demanda_categoria: [
        "bug",
        "melhoria",
        "nova_funcionalidade",
        "duvida",
        "documentacao",
        "outro",
      ],
      demanda_origem: ["email", "reuniao", "chamado", "whatsapp", "outro"],
      demanda_prioridade: ["baixa", "media", "alta", "critica"],
      demanda_status: [
        "aberta",
        "em_analise",
        "em_andamento",
        "aguardando_cliente",
        "homologacao",
        "concluida",
        "cancelada",
      ],
      reuniao_status: ["agendada", "realizada", "cancelada"],
      reuniao_tipo: [
        "interna",
        "cliente",
        "fornecedor",
        "alinhamento",
        "outro",
      ],
      todo_prioridade: ["baixa", "media", "alta"],
      todo_status: ["pendente", "em_andamento", "concluida", "cancelada"],
    },
  },
} as const
