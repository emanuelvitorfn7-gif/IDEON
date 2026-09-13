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
      atividade_questoes: {
        Row: {
          atividade_id: string
          questao_id: string
        }
        Insert: {
          atividade_id: string
          questao_id: string
        }
        Update: {
          atividade_id?: string
          questao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "atividade_questoes_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividade_questoes_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "questoes"
            referencedColumns: ["id"]
          },
        ]
      }
      atividades: {
        Row: {
          criado_em: string
          descricao: string
          id: string
          excluir_ao_vencer: boolean
          prazo_com_hora: boolean
          prazo: string | null
          publicada: boolean
          titulo: string
          turma_id: string
          xp: number
        }
        Insert: {
          criado_em?: string
          descricao?: string
          id?: string
          excluir_ao_vencer?: boolean
          prazo_com_hora?: boolean
          prazo?: string | null
          publicada?: boolean
          titulo: string
          turma_id: string
          xp?: number
        }
        Update: {
          criado_em?: string
          descricao?: string
          id?: string
          excluir_ao_vencer?: boolean
          prazo_com_hora?: boolean
          prazo?: string | null
          publicada?: boolean
          titulo?: string
          turma_id?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "atividades_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      materiais: {
        Row: {
          conteudo: string
          criado_em: string
          id: string
          professor_id: string
          status: string
          tipo: string
          titulo: string
          turma_id: string
        }
        Insert: {
          conteudo?: string
          criado_em?: string
          id?: string
          professor_id: string
          status?: string
          tipo?: string
          titulo: string
          turma_id: string
        }
        Update: {
          conteudo?: string
          criado_em?: string
          id?: string
          professor_id?: string
          status?: string
          tipo?: string
          titulo?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "materiais_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      matriculas: {
        Row: {
          aluno_id: string
          criado_em: string
          id: string
          turma_id: string
        }
        Insert: {
          aluno_id: string
          criado_em?: string
          id?: string
          turma_id: string
        }
        Update: {
          aluno_id?: string
          criado_em?: string
          id?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          criado_em: string
          id: string
          nivel: number
          nome: string
          sequencia: number
          ultima_atividade: string | null
          xp: number
        }
        Insert: {
          criado_em?: string
          id: string
          nivel?: number
          nome?: string
          sequencia?: number
          ultima_atividade?: string | null
          xp?: number
        }
        Update: {
          criado_em?: string
          id?: string
          nivel?: number
          nome?: string
          sequencia?: number
          ultima_atividade?: string | null
          xp?: number
        }
        Relationships: []
      }
      questoes: {
        Row: {
          arquivada: boolean
          alternativas: Json
          aprovada: boolean
          assunto: string
          correta: number
          criado_em: string
          dificuldade: string
          enunciado: string
          explicacao: string
          id: string
          material_id: string | null
          turma_id: string
        }
        Insert: {
          arquivada?: boolean
          alternativas?: Json
          aprovada?: boolean
          assunto?: string
          correta?: number
          criado_em?: string
          dificuldade?: string
          enunciado: string
          explicacao?: string
          id?: string
          material_id?: string | null
          turma_id: string
        }
        Update: {
          arquivada?: boolean
          alternativas?: Json
          aprovada?: boolean
          assunto?: string
          correta?: number
          criado_em?: string
          dificuldade?: string
          enunciado?: string
          explicacao?: string
          id?: string
          material_id?: string | null
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questoes_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questoes_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      submissoes: {
        Row: {
          acertos: number
          aluno_id: string
          atividade_id: string
          concluida_em: string
          detalhes: Json
          id: string
          total: number
          xp_ganho: number
        }
        Insert: {
          acertos?: number
          aluno_id: string
          atividade_id: string
          concluida_em?: string
          detalhes?: Json
          id?: string
          total?: number
          xp_ganho?: number
        }
        Update: {
          acertos?: number
          aluno_id?: string
          atividade_id?: string
          concluida_em?: string
          detalhes?: Json
          id?: string
          total?: number
          xp_ganho?: number
        }
        Relationships: [
          {
            foreignKeyName: "submissoes_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
        ]
      }
      turmas: {
        Row: {
          codigo: string
          criado_em: string
          descricao: string
          disciplina: string
          id: string
          nome: string
          professor_id: string
        }
        Insert: {
          codigo: string
          criado_em?: string
          descricao?: string
          disciplina?: string
          id?: string
          nome: string
          professor_id: string
        }
        Update: {
          codigo?: string
          criado_em?: string
          descricao?: string
          disciplina?: string
          id?: string
          nome?: string
          professor_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      excluir_atividade_professor: {
        Args: { p_atividade_id: string }
        Returns: Json
      }
      atualizar_prazo_atividade_professor: {
        Args: { p_atividade_id: string; p_prazo: string | null; p_excluir_ao_vencer: boolean }
        Returns: undefined
      }
      criar_atividade_professor: {
        Args: { p_turma_id: string; p_titulo: string; p_descricao: string; p_prazo: string | null; p_xp: number; p_questao_ids: string[]; p_publicada: boolean; p_excluir_ao_vencer: boolean }
        Returns: Json
      }
      remover_questoes_professor: {
        Args: { p_turma_id: string; p_questao_ids: string[] }
        Returns: Json
      }
      excluir_material_professor: {
        Args: { p_material_id: string; p_excluir_questoes?: boolean }
        Returns: Json
      }
      excluir_questoes_professor: {
        Args: { p_turma_id: string; p_questao_ids: string[] }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_dono_turma: {
        Args: { _turma: string; _user: string }
        Returns: boolean
      }
      is_matriculado: {
        Args: { _turma: string; _user: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "professor" | "aluno"
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
      app_role: ["professor", "aluno"],
    },
  },
} as const
