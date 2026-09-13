import { z } from "zod";

export const MIN_QUESTOES_IA = 1;
export const MAX_QUESTOES_IA = 30;
export const QUANTIDADE_PADRAO_IA = 6;

export const quantidadeQuestoesSchema = z.number().int().min(MIN_QUESTOES_IA).max(MAX_QUESTOES_IA);

export const entradaGeracaoQuestoesSchema = z.object({
  materialId: z.string().uuid(),
  quantidade: quantidadeQuestoesSchema.default(QUANTIDADE_PADRAO_IA),
});

const questaoIASchema = z.object({
  enunciado: z.string().trim().min(10),
  alternativas: z
    .array(z.string().trim().min(1))
    .length(4)
    .refine((itens) => new Set(itens).size === 4),
  correta: z.number().int().min(0).max(3),
  explicacao: z.string().trim().min(5),
  assunto: z.string().trim().min(2),
  dificuldade: z.enum(["Fácil", "Médio", "Difícil"]),
});

export type QuestaoIA = z.infer<typeof questaoIASchema>;

export class QuantidadeQuestoesIncorretaError extends Error {
  constructor(recebida: number, solicitada: number) {
    super(
      `A IA retornou ${recebida} questões, mas você solicitou ${solicitada}. Nenhuma questão desta geração foi salva. Tente novamente ou escolha uma quantidade menor.`,
    );
  }
}

export function validarQuestoesGeradas(texto: string, quantidade: number): QuestaoIA[] {
  quantidadeQuestoesSchema.parse(quantidade);
  const resultado = z.object({ questoes: z.array(questaoIASchema) }).parse(JSON.parse(texto));
  if (resultado.questoes.length !== quantidade) {
    throw new QuantidadeQuestoesIncorretaError(resultado.questoes.length, quantidade);
  }
  return resultado.questoes;
}
