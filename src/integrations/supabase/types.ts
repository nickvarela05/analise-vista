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
      audit_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          changed_fields: string[] | null
          id: string
          new_data: Json | null
          old_data: Json | null
          operation: string
          record_id: string
          table_name: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[] | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          record_id: string
          table_name: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[] | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      aviso_gestor: {
        Row: {
          ativo: boolean
          colaborador_id: string | null
          colaboradores_ids: string[]
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
          colaborador_id?: string | null
          colaboradores_ids?: string[]
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
          colaborador_id?: string | null
          colaboradores_ids?: string[]
          created_at?: string
          criado_por?: string | null
          expira_em?: string | null
          id?: string
          mensagem?: string
          tipo?: Database["public"]["Enums"]["aviso_tipo"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aviso_gestor_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaborador"
            referencedColumns: ["id"]
          },
        ]
      }
      aviso_leitura: {
        Row: {
          aviso_id: string
          id: string
          lido_em: string
          user_id: string
        }
        Insert: {
          aviso_id: string
          id?: string
          lido_em?: string
          user_id: string
        }
        Update: {
          aviso_id?: string
          id?: string
          lido_em?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aviso_leitura_aviso_id_fkey"
            columns: ["aviso_id"]
            isOneToOne: false
            referencedRelation: "aviso_gestor"
            referencedColumns: ["id"]
          },
        ]
      }
      chamado_externo: {
        Row: {
          abertura: string
          cliente: string | null
          codigo: string
          created_at: string
          descricao: string | null
          equipe_toda: boolean
          id: string
          modulo: string | null
          origem: string | null
          prazo: string | null
          prioridade: Database["public"]["Enums"]["chamado_externo_prioridade"]
          responsaveis_ids: string[]
          responsavel_id: string | null
          status: Database["public"]["Enums"]["chamado_externo_status"]
          tags: string[] | null
          titulo: string
          updated_at: string
        }
        Insert: {
          abertura?: string
          cliente?: string | null
          codigo: string
          created_at?: string
          descricao?: string | null
          equipe_toda?: boolean
          id?: string
          modulo?: string | null
          origem?: string | null
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["chamado_externo_prioridade"]
          responsaveis_ids?: string[]
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["chamado_externo_status"]
          tags?: string[] | null
          titulo: string
          updated_at?: string
        }
        Update: {
          abertura?: string
          cliente?: string | null
          codigo?: string
          created_at?: string
          descricao?: string | null
          equipe_toda?: boolean
          id?: string
          modulo?: string | null
          origem?: string | null
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["chamado_externo_prioridade"]
          responsaveis_ids?: string[]
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["chamado_externo_status"]
          tags?: string[] | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chamado_externo_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "colaborador"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rate_limit: {
        Row: {
          contagem: number
          janela_inicio: string
          telefone: string
        }
        Insert: {
          contagem?: number
          janela_inicio: string
          telefone: string
        }
        Update: {
          contagem?: number
          janela_inicio?: string
          telefone?: string
        }
        Relationships: []
      }
      chat_whatsapp_log: {
        Row: {
          created_at: string
          erro: string | null
          id: string
          latencia_ms: number | null
          pergunta: string
          resposta: string | null
          status: string
          telefone: string
          tokens_input: number | null
          tokens_output: number | null
          tools_chamadas: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          erro?: string | null
          id?: string
          latencia_ms?: number | null
          pergunta: string
          resposta?: string | null
          status?: string
          telefone: string
          tokens_input?: number | null
          tokens_output?: number | null
          tools_chamadas?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          erro?: string | null
          id?: string
          latencia_ms?: number | null
          pergunta?: string
          resposta?: string | null
          status?: string
          telefone?: string
          tokens_input?: number | null
          tokens_output?: number | null
          tools_chamadas?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      colaborador: {
        Row: {
          ativo: boolean
          bio: string | null
          cargo: string | null
          created_at: string
          foto_url: string | null
          id: string
          local_trabalho: Database["public"]["Enums"]["local_trabalho"]
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bio?: string | null
          cargo?: string | null
          created_at?: string
          foto_url?: string | null
          id?: string
          local_trabalho?: Database["public"]["Enums"]["local_trabalho"]
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bio?: string | null
          cargo?: string | null
          created_at?: string
          foto_url?: string | null
          id?: string
          local_trabalho?: Database["public"]["Enums"]["local_trabalho"]
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      colaborador_evento: {
        Row: {
          anexo_url: string | null
          colaborador_id: string
          created_at: string
          data: string
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          observacao: string | null
          registrado_por: string | null
          tipo: Database["public"]["Enums"]["evento_tipo"]
          updated_at: string
        }
        Insert: {
          anexo_url?: string | null
          colaborador_id: string
          created_at?: string
          data: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          observacao?: string | null
          registrado_por?: string | null
          tipo: Database["public"]["Enums"]["evento_tipo"]
          updated_at?: string
        }
        Update: {
          anexo_url?: string | null
          colaborador_id?: string
          created_at?: string
          data?: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          observacao?: string | null
          registrado_por?: string | null
          tipo?: Database["public"]["Enums"]["evento_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_evento_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaborador"
            referencedColumns: ["id"]
          },
        ]
      }
      colaborador_ferias: {
        Row: {
          colaborador_id: string
          created_at: string
          data_fim: string
          data_inicio: string
          id: string
          observacao: string | null
          updated_at: string
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          data_fim: string
          data_inicio: string
          id?: string
          observacao?: string | null
          updated_at?: string
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          data_fim?: string
          data_inicio?: string
          id?: string
          observacao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_ferias_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaborador"
            referencedColumns: ["id"]
          },
        ]
      }
      colaborador_galeria: {
        Row: {
          colaborador_id: string | null
          created_at: string
          foto_url: string
          id: string
          legenda: string | null
          ordem: number
          updated_at: string
        }
        Insert: {
          colaborador_id?: string | null
          created_at?: string
          foto_url: string
          id?: string
          legenda?: string | null
          ordem?: number
          updated_at?: string
        }
        Update: {
          colaborador_id?: string | null
          created_at?: string
          foto_url?: string
          id?: string
          legenda?: string | null
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      colaborador_horario: {
        Row: {
          almoco_fim: string | null
          almoco_inicio: string | null
          colaborador_id: string
          created_at: string
          dia_semana: number
          expediente_fim: string | null
          expediente_inicio: string | null
          id: string
          local_almoco: string | null
          updated_at: string
        }
        Insert: {
          almoco_fim?: string | null
          almoco_inicio?: string | null
          colaborador_id: string
          created_at?: string
          dia_semana: number
          expediente_fim?: string | null
          expediente_inicio?: string | null
          id?: string
          local_almoco?: string | null
          updated_at?: string
        }
        Update: {
          almoco_fim?: string | null
          almoco_inicio?: string | null
          colaborador_id?: string
          created_at?: string
          dia_semana?: number
          expediente_fim?: string | null
          expediente_inicio?: string | null
          id?: string
          local_almoco?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_horario_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaborador"
            referencedColumns: ["id"]
          },
        ]
      }
      demanda: {
        Row: {
          categoria: Database["public"]["Enums"]["demanda_categoria"]
          created_at: string
          criado_por: string | null
          descricao: string | null
          equipe_toda: boolean
          id: string
          origem: Database["public"]["Enums"]["demanda_origem"]
          prazo: string | null
          prioridade: Database["public"]["Enums"]["demanda_prioridade"]
          responsaveis_ids: string[]
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
          equipe_toda?: boolean
          id?: string
          origem?: Database["public"]["Enums"]["demanda_origem"]
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["demanda_prioridade"]
          responsaveis_ids?: string[]
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
          equipe_toda?: boolean
          id?: string
          origem?: Database["public"]["Enums"]["demanda_origem"]
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["demanda_prioridade"]
          responsaveis_ids?: string[]
          responsavel_id?: string | null
          solicitante?: string | null
          status?: Database["public"]["Enums"]["demanda_status"]
          tags?: string[] | null
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          attempts: number
          body_html: string | null
          body_text: string | null
          created_at: string
          id: string
          last_error: string | null
          notificacao_ids: string[] | null
          recipient_email: string
          scheduled_for: string
          sent_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string | null
          webhook_response: Json | null
        }
        Insert: {
          attempts?: number
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          notificacao_ids?: string[] | null
          recipient_email: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
          webhook_response?: Json | null
        }
        Update: {
          attempts?: number
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          notificacao_ids?: string[] | null
          recipient_email?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
          webhook_response?: Json | null
        }
        Relationships: []
      }
      ia_prompt_config: {
        Row: {
          ativo: boolean
          chave: string
          created_at: string
          id: string
          instrucoes_extras: string | null
          prompt_sistema: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean
          chave: string
          created_at?: string
          id?: string
          instrucoes_extras?: string | null
          prompt_sistema: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          chave?: string
          created_at?: string
          id?: string
          instrucoes_extras?: string | null
          prompt_sistema?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      invite_token: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
          updated_at: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          expires_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          token: string
          updated_at?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
          updated_at?: string
          used_at?: string | null
        }
        Relationships: []
      }
      notificacao: {
        Row: {
          created_at: string
          id: string
          lida_em: string | null
          link: string | null
          mensagem: string | null
          metadata: Json | null
          tipo: Database["public"]["Enums"]["notificacao_tipo"]
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida_em?: string | null
          link?: string | null
          mensagem?: string | null
          metadata?: Json | null
          tipo: Database["public"]["Enums"]["notificacao_tipo"]
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida_em?: string | null
          link?: string | null
          mensagem?: string | null
          metadata?: Json | null
          tipo?: Database["public"]["Enums"]["notificacao_tipo"]
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      notificacao_preferencia: {
        Row: {
          ativo: boolean
          canal: Database["public"]["Enums"]["notificacao_canal"]
          created_at: string
          evento: Database["public"]["Enums"]["notificacao_tipo"]
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          canal: Database["public"]["Enums"]["notificacao_canal"]
          created_at?: string
          evento: Database["public"]["Enums"]["notificacao_tipo"]
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          canal?: Database["public"]["Enums"]["notificacao_canal"]
          created_at?: string
          evento?: Database["public"]["Enums"]["notificacao_tipo"]
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cargo: string | null
          colaborador_id: string | null
          created_at: string
          email: string
          id: string
          must_change_password: boolean
          nome: string
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          cargo?: string | null
          colaborador_id?: string | null
          created_at?: string
          email: string
          id?: string
          must_change_password?: boolean
          nome: string
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          cargo?: string | null
          colaborador_id?: string | null
          created_at?: string
          email?: string
          id?: string
          must_change_password?: boolean
          nome?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaborador"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorio_inativo: {
        Row: {
          created_at: string
          id: string
          inativado_por: string | null
          inativado_por_nome: string | null
          motivo: string | null
          solicitacao_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inativado_por?: string | null
          inativado_por_nome?: string | null
          motivo?: string | null
          solicitacao_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inativado_por?: string | null
          inativado_por_nome?: string | null
          motivo?: string | null
          solicitacao_id?: string
        }
        Relationships: []
      }
      resumo_semanal: {
        Row: {
          conteudo_md: string
          created_at: string
          id: string
          insights: string[] | null
          metricas: Json | null
          modelo: string | null
          semana_fim: string
          semana_inicio: string
          user_id: string
        }
        Insert: {
          conteudo_md: string
          created_at?: string
          id?: string
          insights?: string[] | null
          metricas?: Json | null
          modelo?: string | null
          semana_fim: string
          semana_inicio: string
          user_id: string
        }
        Update: {
          conteudo_md?: string
          created_at?: string
          id?: string
          insights?: string[] | null
          metricas?: Json | null
          modelo?: string | null
          semana_fim?: string
          semana_inicio?: string
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
          decisoes: string[] | null
          duracao_min: number | null
          equipe_toda: boolean
          id: string
          link_calendario: string | null
          participantes: string[] | null
          participantes_detectados: string[] | null
          pauta: string | null
          proximos_passos: string | null
          responsaveis_ids: string[]
          responsavel_id: string | null
          resumo: string | null
          status: Database["public"]["Enums"]["reuniao_status"]
          tipo: Database["public"]["Enums"]["reuniao_tipo"]
          titulo: string
          transcricao: string | null
          transcricao_erro: string | null
          transcricao_status: Database["public"]["Enums"]["reuniao_transcricao_status"]
          updated_at: string
        }
        Insert: {
          audio_mime?: string | null
          audio_path?: string | null
          audio_size?: number | null
          created_at?: string
          criado_por?: string | null
          data_reuniao: string
          decisoes?: string[] | null
          duracao_min?: number | null
          equipe_toda?: boolean
          id?: string
          link_calendario?: string | null
          participantes?: string[] | null
          participantes_detectados?: string[] | null
          pauta?: string | null
          proximos_passos?: string | null
          responsaveis_ids?: string[]
          responsavel_id?: string | null
          resumo?: string | null
          status?: Database["public"]["Enums"]["reuniao_status"]
          tipo?: Database["public"]["Enums"]["reuniao_tipo"]
          titulo: string
          transcricao?: string | null
          transcricao_erro?: string | null
          transcricao_status?: Database["public"]["Enums"]["reuniao_transcricao_status"]
          updated_at?: string
        }
        Update: {
          audio_mime?: string | null
          audio_path?: string | null
          audio_size?: number | null
          created_at?: string
          criado_por?: string | null
          data_reuniao?: string
          decisoes?: string[] | null
          duracao_min?: number | null
          equipe_toda?: boolean
          id?: string
          link_calendario?: string | null
          participantes?: string[] | null
          participantes_detectados?: string[] | null
          pauta?: string | null
          proximos_passos?: string | null
          responsaveis_ids?: string[]
          responsavel_id?: string | null
          resumo?: string | null
          status?: Database["public"]["Enums"]["reuniao_status"]
          tipo?: Database["public"]["Enums"]["reuniao_tipo"]
          titulo?: string
          transcricao?: string | null
          transcricao_erro?: string | null
          transcricao_status?: Database["public"]["Enums"]["reuniao_transcricao_status"]
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
          em_teste: boolean
          equipe_toda: boolean
          id: string
          lote_importacao_id: string | null
          origem_importacao: string | null
          prioridade: Database["public"]["Enums"]["todo_prioridade"]
          responsaveis_ids: string[]
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
          em_teste?: boolean
          equipe_toda?: boolean
          id?: string
          lote_importacao_id?: string | null
          origem_importacao?: string | null
          prioridade?: Database["public"]["Enums"]["todo_prioridade"]
          responsaveis_ids?: string[]
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
          em_teste?: boolean
          equipe_toda?: boolean
          id?: string
          lote_importacao_id?: string | null
          origem_importacao?: string | null
          prioridade?: Database["public"]["Enums"]["todo_prioridade"]
          responsaveis_ids?: string[]
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
          {
            foreignKeyName: "todo_lote_importacao_id_fkey"
            columns: ["lote_importacao_id"]
            isOneToOne: false
            referencedRelation: "todo_importacao_lote"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_anexo: {
        Row: {
          autor_id: string | null
          autor_nome: string | null
          created_at: string
          id: string
          mime_type: string | null
          nome_arquivo: string
          storage_path: string
          tamanho_bytes: number | null
          todo_id: string
        }
        Insert: {
          autor_id?: string | null
          autor_nome?: string | null
          created_at?: string
          id?: string
          mime_type?: string | null
          nome_arquivo: string
          storage_path: string
          tamanho_bytes?: number | null
          todo_id: string
        }
        Update: {
          autor_id?: string | null
          autor_nome?: string | null
          created_at?: string
          id?: string
          mime_type?: string | null
          nome_arquivo?: string
          storage_path?: string
          tamanho_bytes?: number | null
          todo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_anexo_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "todo"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_checklist: {
        Row: {
          concluido: boolean
          created_at: string
          id: string
          ordem: number
          texto: string
          todo_id: string
          updated_at: string
        }
        Insert: {
          concluido?: boolean
          created_at?: string
          id?: string
          ordem?: number
          texto: string
          todo_id: string
          updated_at?: string
        }
        Update: {
          concluido?: boolean
          created_at?: string
          id?: string
          ordem?: number
          texto?: string
          todo_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_checklist_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "todo"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_comentario: {
        Row: {
          autor_id: string
          autor_nome: string | null
          conteudo: string
          created_at: string
          id: string
          todo_id: string
        }
        Insert: {
          autor_id: string
          autor_nome?: string | null
          conteudo: string
          created_at?: string
          id?: string
          todo_id: string
        }
        Update: {
          autor_id?: string
          autor_nome?: string | null
          conteudo?: string
          created_at?: string
          id?: string
          todo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_comentario_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "todo"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_historico: {
        Row: {
          autor_id: string | null
          autor_nome: string | null
          campo: string
          created_at: string
          id: string
          todo_id: string
          valor_antigo: string | null
          valor_novo: string | null
        }
        Insert: {
          autor_id?: string | null
          autor_nome?: string | null
          campo: string
          created_at?: string
          id?: string
          todo_id: string
          valor_antigo?: string | null
          valor_novo?: string | null
        }
        Update: {
          autor_id?: string | null
          autor_nome?: string | null
          campo?: string
          created_at?: string
          id?: string
          todo_id?: string
          valor_antigo?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "todo_historico_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "todo"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_importacao_lote: {
        Row: {
          created_at: string
          criado_por: string | null
          descricao: string | null
          id: string
          nome: string
          tipo: string
          total_tarefas: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome: string
          tipo?: string
          total_tarefas?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          tipo?: string
          total_tarefas?: number
          updated_at?: string
        }
        Relationships: []
      }
      unidades_rede: {
        Row: {
          bairro: string | null
          cod_unidade: string
          created_at: string
          endereco: string | null
          id: string
          nome: string
          polo: string | null
          tecnicos: string[]
          tipo: string
          updated_at: string
          zona: string | null
        }
        Insert: {
          bairro?: string | null
          cod_unidade: string
          created_at?: string
          endereco?: string | null
          id?: string
          nome: string
          polo?: string | null
          tecnicos?: string[]
          tipo: string
          updated_at?: string
          zona?: string | null
        }
        Update: {
          bairro?: string | null
          cod_unidade?: string
          created_at?: string
          endereco?: string | null
          id?: string
          nome?: string
          polo?: string | null
          tecnicos?: string[]
          tipo?: string
          updated_at?: string
          zona?: string | null
        }
        Relationships: []
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
      auto_encerrar_tarefas_antigas: { Args: never; Returns: number }
      enqueue_notificacao: {
        Args: {
          _link?: string
          _mensagem?: string
          _metadata?: Json
          _tipo: Database["public"]["Enums"]["notificacao_tipo"]
          _titulo: string
          _user_id: string
        }
        Returns: string
      }
      executar_busca_natural: { Args: { _sql: string }; Returns: Json }
      gerar_notificacoes_prazo: { Args: never; Returns: undefined }
      get_tarefa_counts: {
        Args: never
        Returns: {
          anexos: number
          checklist_done: number
          checklist_total: number
          comentarios: number
          todo_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      limpar_atribuicoes_finalizadas: { Args: never; Returns: Json }
    }
    Enums: {
      app_role: "gestor" | "analista"
      aviso_tipo: "informativo" | "alerta" | "critico"
      chamado_externo_prioridade: "baixa" | "media" | "alta" | "critica"
      chamado_externo_status: "aberto" | "encaminhado" | "finalizado"
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
      evento_tipo: "folga" | "falta" | "atestado" | "atraso" | "ferias_avulso"
      local_trabalho: "escritorio" | "rua"
      notificacao_canal: "in_app" | "email"
      notificacao_tipo:
        | "tarefa_atribuida"
        | "tarefa_prazo"
        | "tarefa_comentario"
        | "tarefa_status"
        | "demanda_atribuida"
        | "demanda_urgente"
        | "chamado_sla"
        | "aviso_critico"
        | "sistema"
        | "resumo_semanal"
      reuniao_status: "agendada" | "realizada" | "cancelada"
      reuniao_tipo:
        | "interna"
        | "cliente"
        | "fornecedor"
        | "alinhamento"
        | "outro"
      reuniao_transcricao_status:
        | "pendente"
        | "processando"
        | "concluido"
        | "erro"
      todo_prioridade: "baixa" | "media" | "alta"
      todo_status:
        | "pendente"
        | "em_andamento"
        | "concluida"
        | "cancelada"
        | "aberta"
        | "encaminhada"
        | "homologacao"
        | "producao"
        | "reprovada"
        | "aprovado"
        | "aprovado_ressalvas"
        | "encerrada"
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
      chamado_externo_prioridade: ["baixa", "media", "alta", "critica"],
      chamado_externo_status: ["aberto", "encaminhado", "finalizado"],
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
      evento_tipo: ["folga", "falta", "atestado", "atraso", "ferias_avulso"],
      local_trabalho: ["escritorio", "rua"],
      notificacao_canal: ["in_app", "email"],
      notificacao_tipo: [
        "tarefa_atribuida",
        "tarefa_prazo",
        "tarefa_comentario",
        "tarefa_status",
        "demanda_atribuida",
        "demanda_urgente",
        "chamado_sla",
        "aviso_critico",
        "sistema",
        "resumo_semanal",
      ],
      reuniao_status: ["agendada", "realizada", "cancelada"],
      reuniao_tipo: [
        "interna",
        "cliente",
        "fornecedor",
        "alinhamento",
        "outro",
      ],
      reuniao_transcricao_status: [
        "pendente",
        "processando",
        "concluido",
        "erro",
      ],
      todo_prioridade: ["baixa", "media", "alta"],
      todo_status: [
        "pendente",
        "em_andamento",
        "concluida",
        "cancelada",
        "aberta",
        "encaminhada",
        "homologacao",
        "producao",
        "reprovada",
        "aprovado",
        "aprovado_ressalvas",
        "encerrada",
      ],
    },
  },
} as const
