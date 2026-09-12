import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  GraduationCap,
  Plus,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/ideon/AppShell";
import { Protegido } from "@/components/ideon/Protegido";
import { StatCard } from "@/components/ideon/StatCard";
import { Barra } from "@/components/ideon/Barra";
import { useAuth } from "@/hooks/useAuth";
import {
  agregarAssuntos,
  criarTurma,
  listarAlunosDaTurma,
  listarQuestoes,
  listarSubmissoesDaTurma,
  listarTurmasProfessor,
} from "@/services/ideon";

export const Route = createFileRoute("/professor/")({
  head: () => ({
    meta: [
      { title: "Painel do professor — Ideon" },
      {
        name: "description",
        content:
          "Acompanhe turmas, desempenho, questões geradas por IA e alertas da sua turma no Ideon.",
      },
      { property: "og:title", content: "Painel do professor — Ideon" },
      {
        property: "og:description",
        content: "Turmas, desempenho e revisão de questões em um só lugar.",
      },
    ],
  }),
  component: () => (
    <Protegido papel="professor">
      <PainelProfessor />
    </Protegido>
  ),
});

function PainelProfessor() {
  const { user, perfil } = useAuth();
  const queryClient = useQueryClient();
  const [criando, setCriando] = useState(false);

  const { data: turmas = [] } = useQuery({
    queryKey: ["turmas-professor", user?.id],
    queryFn: () => listarTurmasProfessor(user!.id),
    enabled: Boolean(user?.id),
  });

  const { data: resumo } = useQuery({
    queryKey: ["resumo-professor", turmas.map((t) => t.id).join(",")],
    enabled: turmas.length > 0,
    queryFn: async () => {
      const partes = await Promise.all(
        turmas.map(async (turma) => {
          const [alunos, { atividades, submissoes }, questoes] = await Promise.all([
            listarAlunosDaTurma(turma.id),
            listarSubmissoesDaTurma(turma.id),
            listarQuestoes(turma.id),
          ]);
          return { turma, alunos, atividades, submissoes, questoes };
        }),
      );
      return partes;
    },
  });

  const partes = resumo ?? [];
  const totalAlunos = partes.reduce((acc, p) => acc + p.alunos.length, 0);
  const publicadas = partes.reduce(
    (acc, p) => acc + p.atividades.filter((a) => a.publicada).length,
    0,
  );
  const todasSubmissoes = partes.flatMap((p) => p.submissoes);
  const esperadas = partes.reduce(
    (acc, p) => acc + p.atividades.filter((a) => a.publicada).length * p.alunos.length,
    0,
  );
  const conclusao = esperadas === 0 ? 0 : Math.round((todasSubmissoes.length / esperadas) * 100);
  const media =
    todasSubmissoes.length === 0
      ? 0
      : Math.round(
          (todasSubmissoes.reduce((acc, s) => acc + (s.total ? s.acertos / s.total : 0), 0) /
            todasSubmissoes.length) *
            100,
        );
  const pendentes = partes.reduce(
    (acc, p) => acc + p.questoes.filter((q) => !q.aprovada).length,
    0,
  );
  const assuntos = agregarAssuntos(todasSubmissoes).slice(0, 4);
  const estrelas = partes
    .flatMap((p) => p.alunos)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 4);

  const alertas: string[] = [];
  for (const assunto of assuntos) {
    if (assunto.taxa < 60) {
      alertas.push(
        `${100 - assunto.taxa}% dos alunos apresentam dificuldade em ${assunto.assunto}.`,
      );
    }
  }
  for (const p of partes) {
    const publicadasTurma = p.atividades.filter((a) => a.publicada).length;
    const pendentesTurma = publicadasTurma * p.alunos.length - p.submissoes.length;
    if (pendentesTurma > 0) {
      alertas.push(`${pendentesTurma} respostas ainda não entregues na turma ${p.turma.nome}.`);
    }
  }
  if (pendentes > 0) alertas.push(`${pendentes} questões geradas pela IA aguardando sua revisão.`);

  async function aoCriarTurma(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      const turma = await criarTurma({
        professorId: user!.id,
        nome: String(form.get("nome") ?? ""),
        disciplina: String(form.get("disciplina") ?? ""),
        descricao: String(form.get("descricao") ?? ""),
      });
      toast.success(`Turma criada. Código: ${turma.codigo}`);
      setCriando(false);
      await queryClient.invalidateQueries({ queryKey: ["turmas-professor"] });
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível criar a turma.");
    }
  }

  return (
    <AppShell nav={[{ rotulo: "Painel", para: "/professor" }]} ativo="/professor">
      <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-aura/20 bg-aura/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-aura">
            <span className="size-1.5 animate-pulse rounded-full bg-aura" />
            Painel do professor
          </div>
          <h1 className="text-display text-4xl md:text-5xl">
            Bem-vindo(a), {perfil?.nome?.split(" ")[0] ?? "professor"}.
          </h1>
          <p className="mt-3 max-w-lg text-lg leading-relaxed text-muted-foreground">
            {turmas.length === 0
              ? "Crie sua primeira turma, envie um material e deixe a IA preparar as questões."
              : "Seu painel está atualizado. Revise as questões geradas antes de publicar as atividades."}
          </p>
        </div>
        <button
          onClick={() => setCriando((v) => !v)}
          className="inline-flex items-center gap-2 rounded-2xl bg-aura px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-aura)] transition hover:opacity-90"
        >
          <Plus className="size-4" /> Nova turma
        </button>
      </div>

      {criando ? (
        <form onSubmit={aoCriarTurma} className="rise-in mb-10 rounded-[2rem] glass-panel p-7">
          <h2 className="text-display text-xl">Criar turma</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <CampoForm nome="nome" rotulo="Nome da turma" obrigatorio />
            <CampoForm nome="disciplina" rotulo="Disciplina" obrigatorio />
            <CampoForm nome="descricao" rotulo="Descrição" />
          </div>
          <button
            type="submit"
            className="mt-5 rounded-xl bg-nova px-5 py-3 text-sm font-semibold text-foreground transition hover:opacity-90"
          >
            Criar e gerar código
          </button>
        </form>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard rotulo="Turmas" valor={turmas.length} icone={BookOpen} />
        <StatCard rotulo="Alunos" valor={totalAlunos} icone={Users} tom="nova" />
        <StatCard
          rotulo="Atividades"
          valor={publicadas}
          detalhe="publicadas"
          icone={GraduationCap}
          tom="mist"
        />
        <StatCard rotulo="Conclusão" valor={`${conclusao}%`} icone={Target} tom="nova" />
        <StatCard rotulo="Média geral" valor={`${media}%`} icone={Sparkles} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <section className="rounded-[2rem] glass-panel p-8 lg:col-span-8">
          <h2 className="text-display text-2xl">Desempenho por turma</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Média de acertos das atividades entregues
          </p>

          {partes.length === 0 ? (
            <p className="mt-10 text-sm text-muted-foreground">
              Nenhum dado ainda. Publique uma atividade para ver o desempenho aqui.
            </p>
          ) : (
            <div className="mt-8 flex h-48 items-end justify-between gap-4">
              {partes.map((p, i) => {
                const mediaTurma =
                  p.submissoes.length === 0
                    ? 0
                    : Math.round(
                        (p.submissoes.reduce(
                          (acc, s) => acc + (s.total ? s.acertos / s.total : 0),
                          0,
                        ) /
                          p.submissoes.length) *
                          100,
                      );
                return (
                  <div key={p.turma.id} className="flex flex-1 flex-col items-center gap-3">
                    <span className="text-xs text-muted-foreground">{mediaTurma}%</span>
                    <div
                      className={`w-full rounded-xl ${i % 2 === 0 ? "bg-gradient-to-t from-aura/20 to-aura" : "bg-gradient-to-t from-nova/20 to-nova"}`}
                      style={{ height: `${Math.max(6, mediaTurma)}%` }}
                    />
                    <span className="truncate text-[10px] font-bold uppercase text-muted-foreground">
                      {p.turma.nome}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-8">
            <h3 className="text-sm font-semibold">Assuntos com maior dificuldade</h3>
            <div className="mt-4 space-y-3.5">
              {assuntos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Assim que os alunos responderem, os assuntos críticos aparecem aqui.
                </p>
              ) : (
                assuntos.map((a) => (
                  <div key={a.assunto}>
                    <div className="flex items-center justify-between text-sm">
                      <span>{a.assunto}</span>
                      <span
                        className={
                          a.taxa < 50
                            ? "text-danger"
                            : a.taxa < 75
                              ? "text-warning"
                              : "text-success"
                        }
                      >
                        {a.taxa}%
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <Barra
                        valor={a.taxa}
                        tom={a.taxa < 50 ? "danger" : a.taxa < 75 ? "warning" : "success"}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="flex flex-col rounded-[2rem] border border-border bg-gradient-to-br from-aura/10 to-nova/5 p-8 lg:col-span-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-warning" />
            <h2 className="text-display text-2xl">Atenção da turma</h2>
          </div>
          <div className="mt-5 flex-1 space-y-3">
            {alertas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tudo em dia por aqui.</p>
            ) : (
              alertas.slice(0, 4).map((alerta) => (
                <div key={alerta} className="rounded-2xl border border-border bg-background/40 p-4">
                  <p className="text-sm text-foreground/85">{alerta}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="mt-12">
        <h2 className="text-display mb-6 text-2xl">Suas turmas</h2>
        {turmas.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Você ainda não tem turmas. Crie a primeira para começar.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {turmas.map((turma) => {
              const parte = partes.find((p) => p.turma.id === turma.id);
              return (
                <Link
                  key={turma.id}
                  to="/Professor/turma/$id"
                  params={{ id: turma.id }}
                  className="group rounded-3xl glass-panel p-6 transition hover:border-aura/30"
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-aura">
                    {turma.disciplina || "Disciplina"}
                  </p>
                  <h3 className="text-display mt-2 text-xl">{turma.nome}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{turma.descricao}</p>
                  <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{parte?.alunos.length ?? 0} alunos</span>
                    <span className="rounded-full bg-background/60 px-2.5 py-1 font-mono text-foreground">
                      {turma.codigo}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {estrelas.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-display mb-6 text-2xl">Estrelas da semana</h2>
          <div className="grid gap-6 sm:grid-cols-4">
            {estrelas.map((aluno, i) => (
              <div key={aluno.id} className="rounded-3xl glass-panel p-6 text-center">
                <div
                  className={`mx-auto grid size-16 place-items-center rounded-2xl bg-secondary text-lg font-semibold ring-2 ${i === 0 ? "ring-aura" : "ring-border"}`}
                >
                  {aluno.nome.slice(0, 2).toUpperCase()}
                </div>
                <p className="mt-4 font-semibold">{aluno.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {aluno.xp.toLocaleString("pt-BR")} XP · Nível {aluno.nivel}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}

function CampoForm({
  nome,
  rotulo,
  obrigatorio,
}: {
  nome: string;
  rotulo: string;
  obrigatorio?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {rotulo}
      </span>
      <input
        name={nome}
        required={obrigatorio}
        className="mt-1.5 w-full rounded-xl border border-input bg-background/40 px-4 py-3 text-sm outline-none transition focus:border-aura/50"
      />
    </label>
  );
}
