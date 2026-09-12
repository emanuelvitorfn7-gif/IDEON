import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const entrada = z.object({
  materialId: z.string().uuid(),
  quantidade: z.number().min(3).max(10).default(6),
});

type QuestaoIA = {
  enunciado: string;
  alternativas: string[];
  correta: number;
  explicacao: string;
  assunto: string;
  dificuldade: "Fácil" | "Médio" | "Difícil";
};

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

export const gerarQuestoes = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => entrada.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: material, error: erroMaterial } = await supabase
      .from("materiais")
      .select("id, titulo, conteudo, turma_id, professor_id")
      .eq("id", data.materialId)
      .single();

    if (erroMaterial || !material) {
      throw new Error("Material não encontrado.");
    }

    if (material.professor_id !== userId) {
      throw new Error("Sem permissão sobre este material.");
    }

    const apiKey = process.env["GEMINI_API_KEY"];

    if (!apiKey) {
      throw new Error("Chave de IA indisponível.");
    }

    await supabase
      .from("materiais")
      .update({ status: "processando" })
      .eq("id", material.id);

    const prompt = `
Você é um assistente pedagógico.

Crie exatamente ${data.quantidade} questões de múltipla escolha
com base EXCLUSIVAMENTE no material abaixo.

TÍTULO:
${material.titulo}

CONTEÚDO:
"""
${(material.conteudo ?? "").slice(0, 12000)}
"""

Retorne SOMENTE um JSON válido com este formato:

{
  "questoes": [
    {
      "enunciado": "Pergunta da questão",
      "alternativas": [
        "Alternativa A",
        "Alternativa B",
        "Alternativa C",
        "Alternativa D"
      ],
      "correta": 0,
      "explicacao": "Explicação da resposta correta",
      "assunto": "Assunto da questão",
      "dificuldade": "Fácil"
    }
  ]
}

REGRAS:

- Gere exatamente ${data.quantidade} questões.
- Cada questão deve possuir exatamente 4 alternativas.
- Somente uma alternativa deve estar correta.
- "correta" deve ser um número inteiro de 0 a 3.
- 0 representa a primeira alternativa.
- 1 representa a segunda alternativa.
- 2 representa a terceira alternativa.
- 3 representa a quarta alternativa.
- "dificuldade" deve ser somente "Fácil", "Médio" ou "Difícil".
- Responda em português do Brasil.
- Não invente informações fora do material.
- Não use Markdown.
- Não escreva \`\`\`json.
- Não escreva nenhum texto antes ou depois do JSON.
`;

    const resposta = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],

          generationConfig: {
            temperature: 0.5,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (resposta.status === 429) {
      await supabase
        .from("materiais")
        .update({ status: "erro" })
        .eq("id", material.id);

      throw new Error(
        "Limite gratuito da IA atingido. Aguarde um pouco e tente novamente.",
      );
    }

    if (!resposta.ok) {
      const erroGemini = await resposta.text();

      console.error("Erro Gemini:", erroGemini);

      await supabase
        .from("materiais")
        .update({ status: "erro" })
        .eq("id", material.id);

      throw new Error(
        `Falha na geração das questões pela IA (${resposta.status}).`,
      );
    }

    const json = (await resposta.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
    };

    const texto =
      json.candidates?.[0]?.content?.parts
        ?.map((parte) => parte.text ?? "")
        .join("")
        .trim() ?? "";

    if (!texto) {
      await supabase
        .from("materiais")
        .update({ status: "erro" })
        .eq("id", material.id);

      throw new Error("A IA não retornou questões.");
    }

    let questoes: QuestaoIA[];

    try {
      const parsed = z
        .object({
          questoes: z.array(questaoIASchema).min(1),
        })
        .parse(JSON.parse(texto));

      questoes = parsed.questoes.slice(0, data.quantidade);
    } catch (erro) {
      console.error("Resposta inválida do Gemini:", texto);
      console.error(erro);

      await supabase
        .from("materiais")
        .update({ status: "erro" })
        .eq("id", material.id);

      throw new Error(
        "A IA retornou questões incompletas. Tente gerar novamente.",
      );
    }

    if (questoes.length === 0) {
      throw new Error("A IA não retornou questões.");
    }

    const linhas = questoes.map((q) => ({
      turma_id: material.turma_id,
      material_id: material.id,

      enunciado: q.enunciado,
      alternativas: q.alternativas,

      correta: q.correta,
      explicacao: q.explicacao,

      assunto: q.assunto,
      dificuldade: q.dificuldade,

      aprovada: false,
    }));

    const { error: erroInsert } = await supabase
      .from("questoes")
      .insert(linhas);

    if (erroInsert) {
      await supabase
        .from("materiais")
        .update({ status: "erro" })
        .eq("id", material.id);

      throw new Error(erroInsert.message);
    }

    await supabase
      .from("materiais")
      .update({ status: "pronto" })
      .eq("id", material.id);

    return {
      criadas: linhas.length,
    };
  });