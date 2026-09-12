import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  FileText,
  GraduationCap,
  Loader2,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/ideon/AppShell";
import { Protegido } from "@/components/ideon/Protegido";
import { StatCard } from "@/components/ideon/StatCard";
import { QuestaoCard } from "@/components/ideon/QuestaoCard";
import { gerarQuestoes } from "@/lib/ia.functions";
import {
  atualizarStatusMaterial,
  criarMaterial,
  listarAlunosDaTurma,
  listarAtividades,
  listarMateriais,
  listarQuestoes,
  obterTurma,
  publicarAtividade,
  salvarAtividade,
  atualizarQuestao,
} from "@/services/ideon";

export const Route = createFileRoute("/Professor/turma/$id")({
  head: () => ({
    meta: [{ title: "Turma — Ideon" }],
  }),
  component: () => (
    <Protegido papel="professor">
      <PainelTurma />
    </Protegido>
  ),
});

function PainelTurma() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();

  const [mostrarFormMaterial, setMostrarFormMaterial] = useState(false);
  const [gerandoPara, setGerandoPara] = useState<string | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [mostrarFormAtividade, setMostrarFormAtividade] = useState(false);
  const [publicando, setPublicando] = useState(false);

  const { data: turma } = useQuery({
    queryKey: ["turma", id],
    queryFn: () => obterTurma(id),
  });
  const { data: alunos = [] } = useQuery({
    queryKey: ["turma-alunos", id],
    queryFn: () => listarAlunosDaTurma(id),
  });
  const { data: materiais = [] } = useQuery({
    queryKey: ["turma-materiais", id],
    queryFn: () => listarMateriais(id),
  });
  const { data: questoes = [] } = useQuery({
    queryKey: ["turma-questoes", id],
    queryFn: () => listarQuestoes(id),
  });
  const { data: atividades = [] } = useQuery({
    queryKey: ["turma-atividades", id],
    queryFn: () => listarAtividades(id),
  });

  const pendentes = questoes.filter((q) => !q.aprovada).length;
  const aprovadas = questoes.filter((q) => q.aprovada);
  const publicadas = atividades.filter((a) => (a as { publicada: boolean }).publicada).length;

  function recarregar() {
    void queryClient.invalidateQueries({ queryKey: ["turma-materiais", id] });
    void queryClient.invalidateQueries({ queryKey: ["turma-questoes", id] });
    void queryClient.invalidateQueries({ queryKey: ["turma-atividades", id] });
  }

  async function aoCriarMaterial(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const titulo = String(form.get("titulo") ?? "");
    const conteudo = String(form.get("conteudo") ?? "");
    if (!titulo.trim() || conteudo.trim().length < 50) {
      toast.error("Cole pelo menos algumas linhas de conteúdo (mínimo 50 caracteres).");
      return;
    }
    try {
      await criarMaterial({
        turmaId: id,
        professorId: turma!.professor_id,
        titulo,
        tipo: "texto",
        conteudo,
      });
      toast.success("Material adicionado.");
      setMostrarFormMaterial(false);
      recarregar();
      e.currentTarget.reset();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar o material.");
    }
  }

  async function aoGerarQuestoes(materialId: string) {
    setGerandoPara(materialId);
    try {
      await atualizarStatusMaterial(materialId, "processando");
      recarregar();
      const resultado = await gerarQuestoes({ data: { materialId, quantidade: 6 } });
      toast.success(`${resultado.criadas} questões geradas. Revise antes de publicar.`);
    } catch (erro) {
      await atualizarStatusMaterial(materialId, "erro");
      toast.error(erro instanceof Error ? erro.message : "Falha ao gerar questões com IA.");
    } finally {
      setGerandoPara(null);
      recarregar();
    }
  }

  function alternarSelecao(questaoId: string, valor: boolean) {
    setSelecionadas((atual) => {
      const novo = new Set(atual);
      if (valor) novo.add(questaoId);
      else novo.delete(questaoId);
      return novo;
    });
  }

  async function aoPublicarAtividade(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (selecionadas.size === 0) {
      toast.error("Selecione pelo menos uma questão aprovada.");
      return;
    }
    const form = new FormData(e.currentTarget);
    setPublicando(true);
    try {
      const acao =
        (e.nativeEvent as SubmitEvent).submitter instanceof HTMLButtonElement
          ? ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement).value
          : "publicar";
      const dadosAtividade = {
        turmaId: id,
        titulo: String(form.get("titulo") ?? ""),
        descricao: String(form.get("descricao") ?? ""),
        prazo: String(form.get("prazo") ?? "") || null,
        xp: Number(form.get("xp") ?? 100),
        questoes: Array.from(selecionadas),
      };
      if (acao === "rascunho") await salvarAtividade({ ...dadosAtividade, publicada: false });
      else await publicarAtividade(dadosAtividade);
      toast.success(acao === "rascunho" ? "Rascunho salvo." : "Atividade publicada para a turma.");
      setSelecionadas(new Set());
      setMostrarFormAtividade(false);
      recarregar();
      e.currentTarget.reset();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível publicar a atividade.");
    } finally {
      setPublicando(false);
    }
  }

  return (
    <AppShell nav={[{ rotulo: "Painel", para: "/professor" }]} ativo="/professor">
      <Link
        to="/professor"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Voltar ao painel
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-aura">
            {turma?.disciplina || "Disciplina"}
          </p>
          <h1 className="text-display text-4xl md:text-5xl">{turma?.nome ?? "Carregando..."}</h1>
          {turma?.descricao ? (
            <p className="mt-3 max-w-lg text-sm text-muted-foreground">{turma.descricao}</p>
          ) : null}
        </div>
        {turma ? (
          <div className="rounded-2xl border border-border bg-background/40 px-5 py-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Código da turma
            </p>
            <p className="mt-1 font-mono text-lg text-foreground">{turma.codigo}</p>
          </div>
        ) : null}
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard rotulo="Alunos" valor={alunos.length} icone={Users} tom="nova" />
        <StatCard rotulo="Materiais" valor={materiais.length} icone={FileText} tom="mist" />
        <StatCard
          rotulo="Questões"
          valor={questoes.length}
          detalhe={pendentes > 0 ? `${pendentes} aguardando revisão` : "todas revisadas"}
          icone={BookOpen}
        />
        <StatCard
          rotulo="Atividades"
          valor={publicadas}
          detalhe="publicadas"
          icone={GraduationCap}
          tom="nova"
        />
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-12">
        <section className="rounded-[2rem] glass-panel p-8 lg:col-span-7">
          <div className="flex items-center justify-between">
            <h2 className="text-display text-2xl">Materiais</h2>
            <button
              onClick={() => setMostrarFormMaterial((v) => !v)}
              className="rounded-xl border border-aura/30 bg-aura/10 px-4 py-2 text-xs font-bold text-aura transition hover:bg-aura/20"
            >
              {mostrarFormMaterial ? "Cancelar" : "+ Adicionar material"}
            </button>
          </div>

          {mostrarFormMaterial ? (
            <form
              onSubmit={aoCriarMaterial}
              className="mt-5 space-y-3 rounded-2xl border border-border p-4"
            >
              <input
                name="titulo"
                required
                placeholder="Título do material (ex.: Aula 4 — Recursividade)"
                className="w-full rounded-xl border border-input bg-background/60 px-4 py-2.5 text-sm outline-none focus:border-aura/50"
              />
              <textarea
                name="conteudo"
                required
                rows={6}
                placeholder="Cole aqui o conteúdo da aula (texto). A IA vai gerar questões só com base nisso."
                className="w-full rounded-xl border border-input bg-background/60 px-4 py-2.5 text-sm outline-none focus:border-aura/50"
              />
              <p className="text-[11px] text-muted-foreground">
                Upload de PDF com extração automática de texto ainda não está disponível — por
                enquanto, cole o texto do material.
              </p>
              <button
                type="submit"
                className="rounded-xl bg-nova px-5 py-2.5 text-sm font-semibold text-foreground transition hover:opacity-90"
              >
                Salvar material
              </button>
            </form>
          ) : null}

          {materiais.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">Nenhum material enviado ainda.</p>
          ) : (
            <ul className="mt-5 space-y-3">
              {materiais.map((m) => {
                const material = m as { id: string; titulo: string; tipo: string; status: string };
                const gerando = gerandoPara === material.id;
                return (
                  <li
                    key={material.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/40 p-4"
                  >
                    <div>
                      <p className="text-sm font-semibold">{material.titulo}</p>
                      <p className="text-xs text-muted-foreground capitalize">{material.tipo}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                          material.status === "erro"
                            ? "bg-danger/15 text-danger"
                            : material.status === "processando"
                              ? "bg-warning/15 text-warning"
                              : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {material.status}
                      </span>
                      <button
                        onClick={() => void aoGerarQuestoes(material.id)}
                        disabled={gerando}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-aura px-3 py-2 text-xs font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                      >
                        {gerando ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="size-3.5" />
                        )}
                        Gerar questões
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <h2 className="text-display mt-10 text-2xl">Revisão de questões</h2>
          {pendentes > 0 ? (
            <button
              onClick={() =>
                void Promise.all(
                  questoes
                    .filter((q) => !q.aprovada)
                    .map((q) => atualizarQuestao(q.id, { aprovada: true })),
                )
                  .then(() => {
                    toast.success("Todas as questões foram aprovadas.");
                    recarregar();
                  })
                  .catch(() => toast.error("Não foi possível aprovar todas."))
              }
              className="mt-3 rounded-xl border border-success/30 bg-success/10 px-4 py-2 text-xs font-bold text-success"
            >
              Aprovar todas
            </button>
          ) : null}
          <p className="mt-1 text-sm text-muted-foreground">
            Aprove, edite ou exclua as questões antes de usá-las em uma atividade.
          </p>
          {questoes.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Nenhuma questão gerada ainda. Adicione um material e clique em "Gerar questões".
            </p>
          ) : (
            <ul className="mt-5 space-y-3">
              {questoes.map((q) => (
                <QuestaoCard
                  key={q.id}
                  questao={q}
                  selecionavel={q.aprovada}
                  selecionada={selecionadas.has(q.id)}
                  aoSelecionar={alternarSelecao}
                  aoMudar={recarregar}
                />
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-6 lg:col-span-5">
          <div className="rounded-[2rem] glass-panel p-8">
            <div className="flex items-center justify-between">
              <h2 className="text-display text-2xl">Atividades</h2>
              <button
                onClick={() => setMostrarFormAtividade((v) => !v)}
                disabled={aprovadas.length === 0}
                className="rounded-xl border border-aura/30 bg-aura/10 px-3 py-1.5 text-[11px] font-bold text-aura transition hover:bg-aura/20 disabled:opacity-40"
              >
                {mostrarFormAtividade ? "Cancelar" : "+ Nova"}
              </button>
            </div>

            {aprovadas.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Aprove questões na coluna ao lado para poder criar uma atividade.
              </p>
            ) : null}

            {mostrarFormAtividade ? (
              <form
                onSubmit={aoPublicarAtividade}
                className="mt-4 space-y-3 rounded-2xl border border-border p-4"
              >
                <input
                  name="titulo"
                  required
                  placeholder="Título da atividade"
                  className="w-full rounded-xl border border-input bg-background/60 px-4 py-2.5 text-sm outline-none focus:border-aura/50"
                />
                <textarea
                  name="descricao"
                  rows={2}
                  placeholder="Descrição (opcional)"
                  className="w-full rounded-xl border border-input bg-background/60 px-4 py-2.5 text-sm outline-none focus:border-aura/50"
                />
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Prazo
                    </span>
                    <input
                      type="date"
                      name="prazo"
                      className="mt-1 w-full rounded-xl border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-aura/50"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      XP
                    </span>
                    <input
                      type="number"
                      name="xp"
                      defaultValue={100}
                      min={10}
                      step={10}
                      className="mt-1 w-full rounded-xl border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-aura/50"
                    />
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  {selecionadas.size} questão(ões) aprovada(s) selecionada(s) ao lado.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    name="acao"
                    value="rascunho"
                    disabled={publicando}
                    className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
                  >
                    Salvar rascunho
                  </button>
                  <button
                    type="submit"
                    name="acao"
                    value="publicar"
                    disabled={publicando}
                    className="rounded-xl bg-aura px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                  >
                    {publicando ? "Salvando..." : "Publicar para a turma"}
                  </button>
                </div>
              </form>
            ) : null}

            {atividades.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Nenhuma atividade publicada ainda.
              </p>
            ) : (
              <ul className="mt-5 space-y-3">
                {atividades.map((a) => {
                  const atividade = a as {
                    id: string;
                    titulo: string;
                    xp: number;
                    publicada: boolean;
                  };
                  return (
                    <li
                      key={atividade.id}
                      className="flex items-center justify-between rounded-2xl border border-border bg-background/40 p-4"
                    >
                      <div>
                        <p className="text-sm font-semibold">{atividade.titulo}</p>
                        <p className="text-xs text-muted-foreground">{atividade.xp} XP</p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                          atividade.publicada
                            ? "bg-success/15 text-success"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {atividade.publicada ? "Publicada" : "Rascunho"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-[2rem] glass-panel p-8">
            <h2 className="text-display text-2xl">Alunos</h2>
            {alunos.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Nenhum aluno matriculado ainda. Compartilhe o código {turma?.codigo ?? ""} com a
                turma.
              </p>
            ) : (
              <ul className="mt-5 space-y-3">
                {alunos
                  .slice()
                  .sort((a, b) => b.xp - a.xp)
                  .map((aluno) => (
                    <li key={aluno.id} className="flex items-center justify-between text-sm">
                      <span>{aluno.nome}</span>
                      <span className="text-xs text-muted-foreground">
                        {aluno.xp.toLocaleString("pt-BR")} XP · Nível {aluno.nivel}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
