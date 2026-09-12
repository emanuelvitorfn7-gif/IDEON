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
      {
        title: "Painel do professor — Ideon",
      },
      {
        name: "description",
        content:
          "Acompanhe turmas, desempenho, questões geradas por IA e alertas da sua turma no Ideon.",
      },
      {
        property: "og:title",
        content: "Painel do professor — Ideon",
      },
      {
        property: "og:description",
        content:
          "Turmas, desempenho e revisão de questões em um só lugar.",
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

  /* =========================================================
     TURMAS DO PROFESSOR
  ========================================================= */

  const { data: turmas = [] } = useQuery({
    queryKey: ["turmas-professor", user?.id],

    queryFn: () => listarTurmasProfessor(user!.id),

    enabled: Boolean(user?.id),
  });

  /* =========================================================
     DADOS GERAIS DAS TURMAS
  ========================================================= */

  const { data: resumo } = useQuery({
    queryKey: [
      "resumo-professor",
      turmas.map((turma) => turma.id).join(","),
    ],

    enabled: turmas.length > 0,

    queryFn: async () => {
      const partes = await Promise.all(
        turmas.map(async (turma) => {
          const [
            alunos,
            { atividades, submissoes },
            questoes,
          ] = await Promise.all([
            listarAlunosDaTurma(turma.id),

            listarSubmissoesDaTurma(turma.id),

            listarQuestoes(turma.id),
          ]);

          return {
            turma,
            alunos,
            atividades,
            submissoes,
            questoes,
          };
        }),
      );

      return partes;
    },
  });

  const partes = resumo ?? [];

  /* =========================================================
     ESTATÍSTICAS
  ========================================================= */

  const totalAlunos = partes.reduce(
    (acc, parte) => acc + parte.alunos.length,
    0,
  );

  const publicadas = partes.reduce(
    (acc, parte) =>
      acc +
      parte.atividades.filter(
        (atividade) => atividade.publicada,
      ).length,
    0,
  );

  const todasSubmissoes = partes.flatMap(
    (parte) => parte.submissoes,
  );

  const esperadas = partes.reduce(
    (acc, parte) =>
      acc +
      parte.atividades.filter(
        (atividade) => atividade.publicada,
      ).length *
        parte.alunos.length,
    0,
  );

  const conclusao =
    esperadas === 0
      ? 0
      : Math.round(
          (todasSubmissoes.length / esperadas) * 100,
        );

  const media =
    todasSubmissoes.length === 0
      ? 0
      : Math.round(
          (todasSubmissoes.reduce(
            (acc, submissao) =>
              acc +
              (submissao.total
                ? submissao.acertos / submissao.total
                : 0),
            0,
          ) /
            todasSubmissoes.length) *
            100,
        );

  const pendentes = partes.reduce(
    (acc, parte) =>
      acc +
      parte.questoes.filter(
        (questao) => !questao.aprovada,
      ).length,
    0,
  );

  /* =========================================================
     ASSUNTOS COM DIFICULDADE
  ========================================================= */

  const assuntos = agregarAssuntos(
    todasSubmissoes,
  ).slice(0, 4);

  /* =========================================================
     MELHORES ALUNOS
  ========================================================= */

  const estrelas = partes
    .flatMap((parte) => parte.alunos)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 4);

  /* =========================================================
     GRÁFICO DE DESEMPENHO POR ATIVIDADE
  ========================================================= */

  const desempenhoAtividades = partes
    .flatMap((parte) =>
      parte.atividades
        .filter(
          (atividade) => atividade.publicada,
        )
        .map((atividade) => {
          const entregas =
            parte.submissoes.filter(
              (submissao) =>
                submissao.atividade_id ===
                atividade.id,
            );

          const mediaAtividade =
            entregas.length === 0
              ? 0
              : Math.round(
                  (entregas.reduce(
                    (acc, submissao) =>
                      acc +
                      (submissao.total
                        ? submissao.acertos /
                          submissao.total
                        : 0),
                    0,
                  ) /
                    entregas.length) *
                    100,
                );

          return {
            id: atividade.id,

            atividade: atividade.titulo,

            turma: parte.turma.nome,

            media: mediaAtividade,

            entregas: entregas.length,
          };
        }),
    )
    .filter(
      (atividade) => atividade.entregas > 0,
    );

  /* =========================================================
     CONFIGURAÇÃO DO GRÁFICO SVG
  ========================================================= */

  const larguraGrafico = 900;

  const alturaGrafico = 250;

  const margemEsquerda = 55;

  const margemDireita = 30;

  const margemSuperior = 30;

  const margemInferior = 45;

  const pontosGrafico =
    desempenhoAtividades.map(
      (atividade, index) => {
        const larguraUtil =
          larguraGrafico -
          margemEsquerda -
          margemDireita;

        const alturaUtil =
          alturaGrafico -
          margemSuperior -
          margemInferior;

        const x =
          desempenhoAtividades.length === 1
            ? margemEsquerda +
              larguraUtil / 2
            : margemEsquerda +
              (index * larguraUtil) /
                (desempenhoAtividades.length -
                  1);

        const y =
          margemSuperior +
          alturaUtil -
          (atividade.media / 100) *
            alturaUtil;

        return {
          ...atividade,
          x,
          y,
        };
      },
    );

  /* =========================================================
     ALERTAS
  ========================================================= */

  const alertas: string[] = [];

  for (const assunto of assuntos) {
    if (assunto.taxa < 60) {
      alertas.push(
        `${100 - assunto.taxa}% dos alunos apresentam dificuldade em ${assunto.assunto}.`,
      );
    }
  }

  for (const parte of partes) {
    const publicadasTurma =
      parte.atividades.filter(
        (atividade) => atividade.publicada,
      ).length;

    const pendentesTurma =
      publicadasTurma *
        parte.alunos.length -
      parte.submissoes.length;

    if (pendentesTurma > 0) {
      alertas.push(
        `${pendentesTurma} respostas ainda não entregues na turma ${parte.turma.nome}.`,
      );
    }
  }

  if (pendentes > 0) {
    alertas.push(
      `${pendentes} questões geradas pela IA aguardando sua revisão.`,
    );
  }

  /* =========================================================
     CRIAR TURMA
  ========================================================= */

  async function aoCriarTurma(
    e: React.FormEvent<HTMLFormElement>,
  ) {
    e.preventDefault();

    const form = new FormData(
      e.currentTarget,
    );

    try {
      const turma = await criarTurma({
        professorId: user!.id,

        nome: String(
          form.get("nome") ?? "",
        ),

        disciplina: String(
          form.get("disciplina") ?? "",
        ),

        descricao: String(
          form.get("descricao") ?? "",
        ),
      });

      toast.success(
        `Turma criada. Código: ${turma.codigo}`,
      );

      setCriando(false);

      await queryClient.invalidateQueries({
        queryKey: ["turmas-professor"],
      });
    } catch (erro) {
      toast.error(
        erro instanceof Error
          ? erro.message
          : "Não foi possível criar a turma.",
      );
    }
  }

  return (
    <AppShell
      nav={[
        {
          rotulo: "Painel",
          para: "/professor",
        },
      ]}
      ativo="/professor"
    >
      {/* =====================================================
          CABEÇALHO
      ===================================================== */}

      <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-aura/20 bg-aura/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-aura">
            <span className="size-1.5 animate-pulse rounded-full bg-aura" />

            Painel do professor
          </div>

          <h1 className="text-display text-4xl md:text-5xl">
            Bem-vindo(a),{" "}
            {perfil?.nome?.split(" ")[0] ??
              "professor"}
            .
          </h1>

          <p className="mt-3 max-w-lg text-lg leading-relaxed text-muted-foreground">
            {turmas.length === 0
              ? "Crie sua primeira turma, envie um material e deixe a IA preparar as questões."
              : "Seu painel está atualizado. Revise as questões geradas antes de publicar as atividades."}
          </p>
        </div>

        <button
          onClick={() =>
            setCriando((valor) => !valor)
          }
          className="inline-flex items-center gap-2 rounded-2xl bg-aura px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-aura)] transition hover:opacity-90"
        >
          <Plus className="size-4" />

          Nova turma
        </button>
      </div>

      {/* =====================================================
          FORMULÁRIO CRIAR TURMA
      ===================================================== */}

      {criando ? (
        <form
          onSubmit={aoCriarTurma}
          className="rise-in mb-10 rounded-[2rem] glass-panel p-7"
        >
          <h2 className="text-display text-xl">
            Criar turma
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <CampoForm
              nome="nome"
              rotulo="Nome da turma"
              obrigatorio
            />

            <CampoForm
              nome="disciplina"
              rotulo="Disciplina"
              obrigatorio
            />

            <CampoForm
              nome="descricao"
              rotulo="Descrição"
            />
          </div>

          <button
            type="submit"
            className="mt-5 rounded-xl bg-nova px-5 py-3 text-sm font-semibold text-foreground transition hover:opacity-90"
          >
            Criar e gerar código
          </button>
        </form>
      ) : null}

      {/* =====================================================
          CARDS DE ESTATÍSTICAS
      ===================================================== */}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          rotulo="Turmas"
          valor={turmas.length}
          icone={BookOpen}
        />

        <StatCard
          rotulo="Alunos"
          valor={totalAlunos}
          icone={Users}
          tom="nova"
        />

        <StatCard
          rotulo="Atividades"
          valor={publicadas}
          detalhe="publicadas"
          icone={GraduationCap}
          tom="mist"
        />

        <StatCard
          rotulo="Conclusão"
          valor={`${conclusao}%`}
          icone={Target}
          tom="nova"
        />

        <StatCard
          rotulo="Média geral"
          valor={`${media}%`}
          icone={Sparkles}
        />
      </section>

      {/* =====================================================
          DESEMPENHO + ALERTAS
      ===================================================== */}

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <section className="rounded-[2rem] glass-panel p-8 lg:col-span-8">
          <h2 className="text-display text-2xl">
            Desempenho por turma
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Evolução da média de acertos nas
            atividades entregues
          </p>

          {/* =================================================
              GRÁFICO DE LINHA
          ================================================= */}

          {desempenhoAtividades.length ===
          0 ? (
            <div className="mt-8 flex h-[280px] items-center justify-center rounded-2xl border border-dashed border-border">
              <div className="text-center">
                <Target className="mx-auto size-7 text-muted-foreground/40" />

                <p className="mt-3 text-sm text-muted-foreground">
                  Ainda não há respostas
                  suficientes para gerar o
                  gráfico.
                </p>

                <p className="mt-1 text-xs text-muted-foreground/60">
                  O gráfico será atualizado
                  automaticamente quando os
                  alunos responderem às
                  atividades.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-8">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">
                    Evolução do desempenho
                  </h3>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Média de acertos por
                    atividade
                  </p>
                </div>

                <div className="rounded-full border border-border bg-background/40 px-3 py-1 text-[10px] font-semibold text-muted-foreground">
                  0% — 100%
                </div>
              </div>

              <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-background/20 p-4">
                <svg
                  viewBox={`0 0 ${larguraGrafico} ${alturaGrafico}`}
                  className="h-[280px] w-full"
                  role="img"
                  aria-label="Gráfico de evolução do desempenho"
                >
                  {/* linhas horizontais e porcentagens */}

                  {[0, 25, 50, 75, 100].map(
                    (valor) => {
                      const alturaUtil =
                        alturaGrafico -
                        margemSuperior -
                        margemInferior;

                      const y =
                        margemSuperior +
                        alturaUtil -
                        (valor / 100) *
                          alturaUtil;

                      return (
                        <g key={valor}>
                          <line
                            x1={margemEsquerda}
                            y1={y}
                            x2={
                              larguraGrafico -
                              margemDireita
                            }
                            y2={y}
                            stroke="currentColor"
                            strokeOpacity="0.12"
                            strokeWidth="1"
                            strokeDasharray="5 7"
                          />

                          <text
                            x={
                              margemEsquerda -
                              12
                            }
                            y={y + 4}
                            textAnchor="end"
                            fill="currentColor"
                            opacity="0.45"
                            fontSize="11"
                          >
                            {valor}%
                          </text>
                        </g>
                      );
                    },
                  )}

                  {/* área suave abaixo da linha */}

                  {pontosGrafico.length > 1 ? (() => {
                    const primeiroPonto = pontosGrafico[0];
                    const ultimoPonto =
                      pontosGrafico[
                        pontosGrafico.length - 1
                      ];

                    if (!primeiroPonto || !ultimoPonto) {
                      return null;
                    }

                    return (
                      <polygon
                        points={[
                          `${primeiroPonto.x},${
                            alturaGrafico -
                            margemInferior
                          }`,

                          ...pontosGrafico.map(
                            (ponto) =>
                              `${ponto.x},${ponto.y}`,
                          ),

                          `${ultimoPonto.x},${
                            alturaGrafico -
                            margemInferior
                          }`,
                        ].join(" ")}
                        fill="currentColor"
                        className="text-aura"
                        opacity="0.06"
                      />
                    );
                  })() : null}

                  {/* linha principal */}

                  {pontosGrafico.length > 1 ? (
                    <polyline
                      points={pontosGrafico
                        .map(
                          (ponto) =>
                            `${ponto.x},${ponto.y}`,
                        )
                        .join(" ")}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-aura"
                    />
                  ) : null}

                  {/* pontos do gráfico */}

                  {pontosGrafico.map(
                    (ponto) => (
                      <g key={ponto.id}>
                        {/* brilho */}

                        <circle
                          cx={ponto.x}
                          cy={ponto.y}
                          r="13"
                          fill="currentColor"
                          className="text-aura"
                          opacity="0.15"
                        />

                        {/* ponto */}

                        <circle
                          cx={ponto.x}
                          cy={ponto.y}
                          r="6"
                          fill="currentColor"
                          className="text-aura"
                        />

                        {/* percentual */}

                        <text
                          x={ponto.x}
                          y={ponto.y - 17}
                          textAnchor="middle"
                          fill="currentColor"
                          fontSize="12"
                          fontWeight="700"
                        >
                          {ponto.media}%
                        </text>

                        {/* nome da atividade */}

                        <text
                          x={ponto.x}
                          y={
                            alturaGrafico -
                            18
                          }
                          textAnchor="middle"
                          fill="currentColor"
                          opacity="0.75"
                          fontSize="11"
                          fontWeight="600"
                        >
                          {ponto.atividade
                            .length > 16
                            ? `${ponto.atividade.slice(
                                0,
                                16,
                              )}…`
                            : ponto.atividade}
                        </text>

                        {/* nome da turma */}

                        <text
                          x={ponto.x}
                          y={
                            alturaGrafico -
                            5
                          }
                          textAnchor="middle"
                          fill="currentColor"
                          opacity="0.4"
                          fontSize="9"
                        >
                          {ponto.turma}
                        </text>
                      </g>
                    ),
                  )}
                </svg>
              </div>
            </div>
          )}

          {/* =================================================
              ASSUNTOS COM MAIOR DIFICULDADE
          ================================================= */}

          <div className="mt-8">
            <h3 className="text-sm font-semibold">
              Assuntos com maior dificuldade
            </h3>

            <div className="mt-4 space-y-3.5">
              {assuntos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Assim que os alunos
                  responderem, os assuntos
                  críticos aparecem aqui.
                </p>
              ) : (
                assuntos.map((assunto) => (
                  <div key={assunto.assunto}>
                    <div className="flex items-center justify-between text-sm">
                      <span>
                        {assunto.assunto}
                      </span>

                      <span
                        className={
                          assunto.taxa < 50
                            ? "text-danger"
                            : assunto.taxa <
                                75
                              ? "text-warning"
                              : "text-success"
                        }
                      >
                        {assunto.taxa}%
                      </span>
                    </div>

                    <div className="mt-1.5">
                      <Barra
                        valor={assunto.taxa}
                        tom={
                          assunto.taxa < 50
                            ? "danger"
                            : assunto.taxa <
                                75
                              ? "warning"
                              : "success"
                        }
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* ===================================================
            ALERTAS
        =================================================== */}

        <section className="flex flex-col rounded-[2rem] border border-border bg-gradient-to-br from-aura/10 to-nova/5 p-8 lg:col-span-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-warning" />

            <h2 className="text-display text-2xl">
              Atenção da turma
            </h2>
          </div>

          <div className="mt-5 flex-1 space-y-3">
            {alertas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Tudo em dia por aqui.
              </p>
            ) : (
              alertas
                .slice(0, 4)
                .map((alerta) => (
                  <div
                    key={alerta}
                    className="rounded-2xl border border-border bg-background/40 p-4"
                  >
                    <p className="text-sm text-foreground/85">
                      {alerta}
                    </p>
                  </div>
                ))
            )}
          </div>
        </section>
      </div>

      {/* =====================================================
          TURMAS
      ===================================================== */}

      <section className="mt-12">
        <h2 className="text-display mb-6 text-2xl">
          Suas turmas
        </h2>

        {turmas.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Você ainda não tem turmas.
              Crie a primeira para começar.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {turmas.map((turma) => {
              const parte = partes.find(
                (item) =>
                  item.turma.id ===
                  turma.id,
              );

              return (
                <Link
                  key={turma.id}
                  to="/Professor/turma/$id"
                  params={{
                    id: turma.id,
                  }}
                  className="group rounded-3xl glass-panel p-6 transition hover:border-aura/30"
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-aura">
                    {turma.disciplina ||
                      "Disciplina"}
                  </p>

                  <h3 className="text-display mt-2 text-xl">
                    {turma.nome}
                  </h3>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {turma.descricao}
                  </p>

                  <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {parte?.alunos.length ??
                        0}{" "}
                      alunos
                    </span>

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

      {/* =====================================================
          ESTRELAS DA SEMANA
      ===================================================== */}

      {estrelas.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-display mb-6 text-2xl">
            Estrelas da semana
          </h2>

          <div className="grid gap-6 sm:grid-cols-4">
            {estrelas.map(
              (aluno, index) => (
                <div
                  key={aluno.id}
                  className="rounded-3xl glass-panel p-6 text-center"
                >
                  <div
                    className={`mx-auto grid size-16 place-items-center rounded-2xl bg-secondary text-lg font-semibold ring-2 ${
                      index === 0
                        ? "ring-aura"
                        : "ring-border"
                    }`}
                  >
                    {aluno.nome
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>

                  <p className="mt-4 font-semibold">
                    {aluno.nome}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {aluno.xp.toLocaleString(
                      "pt-BR",
                    )}{" "}
                    XP · Nível{" "}
                    {aluno.nivel}
                  </p>
                </div>
              ),
            )}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}

/* ===========================================================
   CAMPO DO FORMULÁRIO
=========================================================== */

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