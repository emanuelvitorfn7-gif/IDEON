import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const atividadeIdSchema = z.object({ atividadeId: z.string().uuid() });
const submissaoSchema = atividadeIdSchema.extend({
  respostas: z.record(z.string().uuid(), z.number().int().min(0).max(3)),
});

export type QuestaoAluno = {
  id: string;
  enunciado: string;
  alternativas: string[];
  assunto: string;
  dificuldade: string;
};

export const carregarAtividadeAluno = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => atividadeIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const cliente = context.supabase as unknown as {
      rpc: (
        nome: string,
        parametros: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { data: resultado, error } = await cliente.rpc("get_activity_for_student", {
      p_activity_id: data.atividadeId,
    });
    if (error) throw new Error(error.message);
    if (!resultado) throw new Error("Atividade não encontrada ou indisponível.");
    return resultado as {
      id: string;
      titulo: string;
      descricao: string;
      prazo: string | null;
      prazo_com_hora: boolean;
      questoes: QuestaoAluno[];
    };
  });

export const enviarSubmissao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => submissaoSchema.parse(data))
  .handler(async ({ data, context }) => {
    const cliente = context.supabase as unknown as {
      rpc: (
        nome: string,
        parametros: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { data: resultado, error } = await cliente.rpc("submit_activity", {
      p_activity_id: data.atividadeId,
      p_answers: data.respostas,
    });
    if (error) throw new Error(error.message);
    return resultado as {
      acertos: number;
      total: number;
      xp_ganho: number;
      ja_enviada: boolean;
      detalhes: Array<{
        questao_id: string;
        acertou: boolean;
        correta: number;
        explicacao: string;
      }>;
    };
  });
