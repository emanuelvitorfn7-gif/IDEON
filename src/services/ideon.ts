import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { gerarCodigoTurma } from "@/lib/gamificacao";
import { validarConteudoMaterial } from "@/lib/conteudo-material";

export type Turma = {
  id: string;
  nome: string;
  disciplina: string;
  descricao: string;
  codigo: string;
  professor_id: string;
};

export type Questao = {
  id: string;
  turma_id: string;
  material_id: string | null;
  enunciado: string;
  alternativas: string[];
  correta: number;
  explicacao: string;
  assunto: string;
  dificuldade: string;
  aprovada: boolean;
  em_uso: boolean;
  arquivada: boolean;
};

export type DetalheResposta = { questao_id: string; assunto: string; acertou: boolean };

function normalizarQuestao(q: Record<string, unknown>): Questao {
  const alternativas = Array.isArray(q["alternativas"]) ? (q["alternativas"] as string[]) : [];
  const vinculos = q["atividade_questoes"];
  return {
    ...(q as unknown as Questao),
    alternativas,
    em_uso: Array.isArray(vinculos) && vinculos.length > 0,
    arquivada: q["arquivada"] === true,
  };
}

/* ---------------- Professor ---------------- */

export async function listarTurmasProfessor(professorId: string) {
  const { data, error } = await supabase
    .from("turmas")
    .select("*")
    .eq("professor_id", professorId)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Turma[];
}

export async function criarTurma(input: {
  professorId: string;
  nome: string;
  disciplina: string;
  descricao: string;
}) {
  const { data, error } = await supabase
    .from("turmas")
    .insert({
      professor_id: input.professorId,
      nome: input.nome,
      disciplina: input.disciplina,
      descricao: input.descricao,
      codigo: gerarCodigoTurma(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as Turma;
}

export async function obterTurma(turmaId: string) {
  const { data, error } = await supabase.from("turmas").select("*").eq("id", turmaId).single();
  if (error) throw error;
  return data as Turma;
}

export async function listarMateriais(turmaId: string) {
  const { data, error } = await supabase
    .from("materiais")
    .select("*")
    .eq("turma_id", turmaId)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function criarMaterial(input: {
  turmaId: string;
  professorId: string;
  titulo: string;
  tipo: string;
  conteudo: string;
}) {
  const { data, error } = await supabase
    .from("materiais")
    .insert({
      turma_id: input.turmaId,
      professor_id: input.professorId,
      titulo: input.titulo,
      tipo: input.tipo,
      conteudo: validarConteudoMaterial(input.conteudo),
      status: "pronto",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function atualizarStatusMaterial(
  id: string,
  status: "processando" | "pronto" | "erro",
) {
  const { error } = await supabase.from("materiais").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function listarQuestoes(turmaId: string) {
  const { data, error } = await supabase
    .from("questoes")
    .select("*, atividade_questoes(atividade_id)")
    .eq("turma_id", turmaId)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .map((q) => normalizarQuestao(q as Record<string, unknown>))
    .filter((q) => !q.arquivada);
}

export async function atualizarQuestao(id: string, patch: Partial<Omit<Questao, "em_uso">>) {
  const { error } = await supabase.from("questoes").update(patch).eq("id", id);
  if (error) throw error;
}

type ResultadoExclusao = { excluidas: string[]; preservadas: number };

function erroExclusao(
  error: { code?: string; message: string },
  recurso = "exclusão de materiais",
): Error {
  if (error.code === "PGRST202") {
    return new Error(`A configuração de ${recurso} ainda não foi concluída neste ambiente.`);
  }
  return new Error(error.message);
}

export async function excluirMaterial(materialId: string, excluirQuestoesSemUso = false) {
  const { data, error } = await supabase.rpc("excluir_material_professor", {
    p_material_id: materialId,
    p_excluir_questoes: excluirQuestoesSemUso,
  });
  if (error) throw erroExclusao(error);
  return data as ResultadoExclusao;
}

export async function excluirQuestoes(turmaId: string, ids: string[]) {
  const { data, error } = await supabase.rpc("excluir_questoes_professor", {
    p_turma_id: turmaId,
    p_questao_ids: [...new Set(ids)],
  });
  if (error) throw erroExclusao(error, "exclusão de questões");
  return data as ResultadoExclusao;
}

export async function removerQuestoes(turmaId: string, ids: string[]) {
  const { data, error } = await supabase.rpc("remover_questoes_professor", {
    p_turma_id: turmaId,
    p_questao_ids: [...new Set(ids)],
  });
  if (error) throw erroExclusao(error, "remoção e arquivamento de questões");
  return data as { excluidas: string[]; arquivadas: string[] };
}

export async function listarAtividades(turmaId: string) {
  const { data, error } = await supabase
    .from("atividades")
    .select("*, atividade_questoes(questao_id)")
    .eq("turma_id", turmaId)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function excluirAtividade(atividadeId: string) {
  const { data, error } = await supabase.rpc("excluir_atividade_professor", {
    p_atividade_id: atividadeId,
  });
  if (error) throw erroExclusao(error, "exclusão de atividades");
  return data as ResultadoExclusao;
}

export async function atualizarPrazoAtividade(
  atividadeId: string,
  prazo: string | null,
  excluirAoVencer: boolean,
) {
  const { error } = await supabase.rpc("atualizar_prazo_atividade_professor", {
    p_atividade_id: atividadeId,
    p_prazo: prazo,
    p_excluir_ao_vencer: excluirAoVencer,
  });
  if (error) throw erroExclusao(error, "prazos de atividades");
}

export async function salvarAtividade(input: {
  turmaId: string;
  titulo: string;
  descricao: string;
  prazo: string | null;
  xp: number;
  questoes: string[];
  publicada: boolean;
  excluirAoVencer: boolean;
}) {
  if (input.questoes.length === 0) throw new Error("Selecione pelo menos uma questão aprovada.");
  const { data, error } = await supabase.rpc("criar_atividade_professor", {
    p_turma_id: input.turmaId,
    p_titulo: input.titulo,
    p_descricao: input.descricao,
    p_prazo: input.prazo,
    p_xp: input.xp,
    p_questao_ids: [...new Set(input.questoes)],
    p_publicada: input.publicada,
    p_excluir_ao_vencer: input.excluirAoVencer,
  });
  if (error) throw erroExclusao(error, "criação de atividades");
  return data as Database["public"]["Tables"]["atividades"]["Row"];
}

export const publicarAtividade = (
  input: Omit<Parameters<typeof salvarAtividade>[0], "publicada">,
) => salvarAtividade({ ...input, publicada: true });

export async function listarAlunosDaTurma(turmaId: string) {
  const { data: matriculas, error: erroMatriculas } = await supabase
    .from("matriculas")
    .select("aluno_id")
    .eq("turma_id", turmaId);

  if (erroMatriculas) throw erroMatriculas;

  if (!matriculas || matriculas.length === 0) {
    return [];
  }

  const idsAlunos = matriculas.map((m) => m.aluno_id);

  const { data: perfis, error: erroPerfis } = await supabase
    .from("profiles")
    .select("id, nome, xp, nivel, sequencia")
    .in("id", idsAlunos);

  if (erroPerfis) throw erroPerfis;

  return (
    perfis?.map((perfil) => ({
      id: perfil.id,
      nome: perfil.nome,
      xp: perfil.xp ?? 0,
      nivel: perfil.nivel ?? 1,
      sequencia: perfil.sequencia ?? 0,
    })) ?? []
  );
}

export async function listarSubmissoesDaTurma(turmaId: string) {
  const { data: atividades, error } = await supabase
    .from("atividades")
    .select("id, titulo, xp, publicada, criado_em")
    .eq("turma_id", turmaId)
    .order("criado_em", { ascending: true });

  if (error) throw error;

  const ids = (atividades ?? []).map((a) => a.id);

  if (ids.length === 0) {
    return {
      atividades: atividades ?? [],
      submissoes: [],
    };
  }

  const { data: submissoes, error: erroSub } = await supabase
    .from("submissoes")
    .select("*")
    .in("atividade_id", ids);

  if (erroSub) throw erroSub;

  return {
    atividades: atividades ?? [],
    submissoes: submissoes ?? [],
  };
}

export function agregarAssuntos(submissoes: Array<{ detalhes: unknown }>) {
  const mapa = new Map<string, { acertos: number; total: number }>();
  for (const s of submissoes) {
    const detalhes = Array.isArray(s.detalhes) ? (s.detalhes as DetalheResposta[]) : [];
    for (const d of detalhes) {
      const atual = mapa.get(d.assunto) ?? { acertos: 0, total: 0 };
      atual.total += 1;
      if (d.acertou) atual.acertos += 1;
      mapa.set(d.assunto, atual);
    }
  }
  return Array.from(mapa.entries())
    .map(([assunto, v]) => ({
      assunto,
      taxa: v.total === 0 ? 0 : Math.round((v.acertos / v.total) * 100),
      total: v.total,
    }))
    .sort((a, b) => a.taxa - b.taxa);
}

/* ---------------- Aluno ---------------- */

export async function listarTurmasAluno(alunoId: string) {
  const { data, error } = await supabase
    .from("matriculas")
    .select("turma_id, turmas:turma_id (*)")
    .eq("aluno_id", alunoId);
  if (error) throw error;
  return (data ?? [])
    .map((m) => (m as unknown as { turmas: Turma | null }).turmas)
    .filter((t): t is Turma => Boolean(t));
}

export async function entrarNaTurma(alunoId: string, codigo: string) {
  const { data: turma, error } = await supabase
    .from("turmas")
    .select("id, nome")
    .eq("codigo", codigo.trim().toUpperCase())
    .maybeSingle();
  if (error) throw error;
  if (!turma) throw new Error("Código de turma não encontrado.");

  const { error: erroMatricula } = await supabase
    .from("matriculas")
    .insert({ turma_id: turma.id, aluno_id: alunoId });
  if (erroMatricula && !erroMatricula.message.includes("duplicate")) throw erroMatricula;
  return turma;
}

export async function listarAtividadesDoAluno(alunoId: string) {
  const turmas = await listarTurmasAluno(alunoId);
  const ids = turmas.map((t) => t.id);
  if (ids.length === 0) return { turmas, atividades: [], submissoes: [] };

  const { data: atividades, error } = await supabase
    .from("atividades")
    .select("*, atividade_questoes(questao_id)")
    .in("turma_id", ids)
    .eq("publicada", true)
    .order("criado_em", { ascending: false });
  if (error) throw error;

  const { data: submissoes, error: erroSub } = await supabase
    .from("submissoes")
    .select("*")
    .eq("aluno_id", alunoId);
  if (erroSub) throw erroSub;

  return { turmas, atividades: atividades ?? [], submissoes: submissoes ?? [] };
}

export async function rankingDaTurma(turmaId: string) {
  const alunos = await listarAlunosDaTurma(turmaId);
  return alunos.sort((a, b) => b.xp - a.xp);
}
