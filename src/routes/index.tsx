import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BrainCircuit, Flame, LineChart, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { Logo } from "@/components/ideon/Logo";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ideon — a aula não termina quando o sinal toca" },
      {
        name: "description",
        content:
          "Plataforma educacional que transforma o material do professor em trilhas gamificadas com IA, XP, níveis e acompanhamento de desempenho.",
      },
      { property: "og:title", content: "Ideon — a aula não termina quando o sinal toca" },
      {
        property: "og:description",
        content: "Material do professor + IA = questões, XP e evolução real da turma.",
      },
    ],
  }),
  component: Index,
});

const pilares = [
  {
    icone: BrainCircuit,
    titulo: "IA fiel ao material",
    texto: "As questões nascem só do conteúdo enviado pelo professor. Nada de assunto inventado.",
  },
  {
    icone: ShieldCheck,
    titulo: "Professor no controle",
    texto: "Nada chega ao aluno sem revisão e aprovação de quem dá a aula.",
  },
  {
    icone: Trophy,
    titulo: "Evolução visível",
    texto: "XP, níveis, sequência de estudo e ranking mantêm a turma em movimento.",
  },
];

function Index() {
  const { session, papel, carregando } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!carregando && session && papel) {
      void navigate({ to: papel === "professor" ? "/professor" : "/aluno" });
    }
  }, [carregando, session, papel, navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -top-24 right-10 size-96 rounded-full bg-aura/15 blur-3xl aura-pulse" />
      <div
        className="pointer-events-none absolute bottom-0 -left-24 size-80 rounded-full bg-nova/10 blur-3xl aura-pulse"
        style={{ animationDelay: "3s" }}
      />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between border-b border-border px-6 py-6 md:px-8">
        <Logo />
        <Link
          to="/auth"
          className="rounded-xl border border-nova/20 bg-nova/10 px-4 py-2 text-sm font-semibold text-nova transition hover:bg-nova/20"
        >
          Entrar
        </Link>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 py-16 md:px-8 md:py-24">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-aura/20 bg-aura/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-aura">
            <span className="size-1.5 animate-pulse rounded-full bg-aura" />
            Aprendizagem gamificada com IA
          </div>
          <h1 className="text-display text-4xl leading-tight md:text-6xl">
            A aula não termina quando o sinal toca.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            O Ideon transforma PDFs, textos e slides do professor em quizzes, desafios e trilhas de estudo.
            O aluno responde, recebe feedback na hora, ganha XP e evolui — com o professor acompanhando tudo.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="rounded-2xl bg-aura px-6 py-4 text-sm font-bold text-primary-foreground shadow-[var(--shadow-aura)] transition hover:opacity-90"
            >
              Começar agora
            </Link>
            <Link
              to="/auth"
              search={{ modo: "entrar" }}
              className="rounded-2xl border border-border px-6 py-4 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
            >
              Já tenho conta
            </Link>
          </div>
        </div>

        <section className="mt-24 grid gap-6 md:grid-cols-3">
          {pilares.map((p) => (
            <div key={p.titulo} className="rise-in rounded-3xl glass-panel p-7">
              <p.icone className="size-5 text-aura" />
              <h2 className="text-display mt-5 text-xl">{p.titulo}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.texto}</p>
            </div>
          ))}
        </section>

        <section className="mt-20 rounded-[2rem] glass-panel p-8 md:p-10">
          <h2 className="text-display text-2xl">Como funciona</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-4">
            {[
              { n: "01", t: "Professor cria a turma", d: "Código único para os alunos entrarem." },
              { n: "02", t: "Envia o material", d: "PDF ou texto da própria aula." },
              { n: "03", t: "IA gera e o professor aprova", d: "Questões, gabarito e explicações." },
              { n: "04", t: "Aluno responde e evolui", d: "Feedback imediato, XP e ranking." },
            ].map((etapa) => (
              <li key={etapa.n}>
                <p className="text-display text-3xl text-aura/40">{etapa.n}</p>
                <p className="mt-2 font-semibold">{etapa.t}</p>
                <p className="mt-1 text-sm text-muted-foreground">{etapa.d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-20 flex flex-wrap items-center gap-8 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <Sparkles className="size-4 text-aura" /> Questões revisadas pelo professor
          </span>
          <span className="inline-flex items-center gap-2">
            <Flame className="size-4 text-warning" /> Sequência de estudo
          </span>
          <span className="inline-flex items-center gap-2">
            <LineChart className="size-4 text-nova" /> Assuntos com maior dificuldade
          </span>
        </section>
      </main>
    </div>
  );
}
