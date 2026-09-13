import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Flame, ListChecks, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/ideon/AppShell";
import { Protegido } from "@/components/ideon/Protegido";
import { StatCard } from "@/components/ideon/StatCard";
import { Barra } from "@/components/ideon/Barra";
import { ActivityRunner } from "@/components/ideon/ActivityRunner";
import { useAuth } from "@/hooks/useAuth";
import { formatarPrazo } from "@/lib/datas";
import { progressoNivel, tituloPorNivel, xpNoNivel, XP_POR_NIVEL } from "@/lib/gamificacao";
import { entrarNaTurma, listarAtividadesDoAluno } from "@/services/ideon";

export const Route = createFileRoute("/aluno/")({
  head: () => ({
    meta: [
      { title: "Painel do aluno — Ideon" },
      {
        name: "description",
        content: "Acompanhe suas atividades, XP, nível e sequência de estudos no Ideon.",
      },
    ],
  }),
  component: () => (
    <Protegido papel="aluno">
      <PainelAluno />
    </Protegido>
  ),
});

function PainelAluno() {
  const { user, perfil } = useAuth();
  const queryClient = useQueryClient();
  const [codigo, setCodigo] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [atividadeAberta, setAtividadeAberta] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["atividades-aluno", user?.id],
    queryFn: () => listarAtividadesDoAluno(user!.id),
    enabled: Boolean(user?.id),
  });

  const turmas = data?.turmas ?? [];
  const atividades = data?.atividades ?? [];
  const submissoes = data?.submissoes ?? [];
  const idsRespondidos = new Set(
    submissoes.map((s) => (s as { atividade_id: string }).atividade_id),
  );
  const pendentes = atividades.filter((a) => !idsRespondidos.has((a as { id: string }).id));
  const concluidas = atividades.length - pendentes.length;

  const xp = perfil?.xp ?? 0;
  const nivel = perfil?.nivel ?? 1;
  const sequencia = perfil?.sequencia ?? 0;

  async function aoEntrarNaTurma(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !codigo.trim()) return;
    setEntrando(true);
    try {
      const turma = await entrarNaTurma(user.id, codigo);
      toast.success(`Você entrou na turma ${turma.nome}.`);
      setCodigo("");
      await queryClient.invalidateQueries({ queryKey: ["atividades-aluno"] });
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível entrar na turma.");
    } finally {
      setEntrando(false);
    }
  }

  return (
    <AppShell nav={[{ rotulo: "Painel", para: "/aluno" }]} ativo="/aluno">
      {atividadeAberta ? (
        <ActivityRunner atividadeId={atividadeAberta} aoFechar={() => setAtividadeAberta(null)} />
      ) : null}
      <div className="mb-10">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-aura/20 bg-aura/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-aura">
          <span className="size-1.5 animate-pulse rounded-full bg-aura" />
          Painel do aluno
        </div>
        <h1 className="text-display text-4xl md:text-5xl">
          Olá, {perfil?.nome?.split(" ")[0] ?? "explorador(a)"}.
        </h1>
      </div>

      <section className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-[2rem] glass-panel p-8 lg:col-span-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Nível {nivel}
              </p>
              <h2 className="text-display text-2xl">{tituloPorNivel(nivel)}</h2>
            </div>
            <Trophy className="size-6 text-aura" />
          </div>
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {xpNoNivel(xp)} / {XP_POR_NIVEL} XP
              </span>
              <span>{progressoNivel(xp)}%</span>
            </div>
            <div className="mt-1.5">
              <Barra valor={progressoNivel(xp)} tom="aura" />
            </div>
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Flame className="size-4 text-warning" />
            {sequencia > 0
              ? `${sequencia} dia(s) seguidos estudando`
              : "Comece hoje sua sequência de estudos"}
          </div>
        </div>

        <div className="rounded-[2rem] glass-panel p-8 lg:col-span-5">
          <h2 className="text-display text-xl">Entrar em uma turma</h2>
          <p className="mt-1 text-sm text-muted-foreground">Peça o código ao seu professor.</p>
          <form onSubmit={aoEntrarNaTurma} className="mt-5 flex gap-2">
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ex.: AB-2026-14"
              className="w-full rounded-xl border border-input bg-background/40 px-4 py-3 text-sm uppercase outline-none transition focus:border-aura/50"
            />
            <button
              type="submit"
              disabled={entrando}
              className="shrink-0 rounded-xl bg-aura px-5 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              Entrar
            </button>
          </form>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard rotulo="Turmas" valor={turmas.length} icone={Sparkles} />
        <StatCard
          rotulo="Atividades pendentes"
          valor={pendentes.length}
          icone={ListChecks}
          tom="nova"
        />
        <StatCard rotulo="Concluídas" valor={concluidas} tom="mist" />
      </section>

      <section className="mt-10">
        <h2 className="text-display mb-6 text-2xl">Atividades pendentes</h2>
        {pendentes.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">
              {turmas.length === 0
                ? "Entre em uma turma com o código do seu professor para começar."
                : "Nenhuma atividade pendente agora. Volte mais tarde."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pendentes.map((a) => {
              const atividade = a as {
                id: string;
                titulo: string;
                xp: number;
                prazo: string | null;
              };
              return (
                <div key={atividade.id} className="rounded-3xl glass-panel p-6">
                  <h3 className="text-display text-lg">{atividade.titulo}</h3>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {atividade.xp} XP
                    {atividade.prazo ? ` · prazo ${formatarPrazo(atividade.prazo)}` : ""}
                  </p>
                  <button
                    onClick={() => setAtividadeAberta(atividade.id)}
                    className="mt-5 w-full rounded-xl bg-aura px-4 py-2.5 text-sm font-bold text-primary-foreground"
                  >
                    Responder agora
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
