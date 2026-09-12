import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/ideon/Logo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Papel } from "@/hooks/useAuth";

type Busca = { modo?: "entrar" | "criar" };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): Busca =>
    search["modo"] === "entrar" || search["modo"] === "criar" ? { modo: search["modo"] } : {},
  head: () => ({
    meta: [
      { title: "Entrar no Ideon" },
      {
        name: "description",
        content: "Acesse o Ideon como professor ou aluno e continue sua jornada.",
      },
      { property: "og:title", content: "Entrar no Ideon" },
      { property: "og:description", content: "Acesse como professor ou aluno." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const busca = Route.useSearch();
  const navigate = useNavigate();
  const { session, papel, carregando } = useAuth();

  const [modo, setModo] = useState<"entrar" | "criar">(
    busca.modo === "entrar" ? "entrar" : "criar",
  );
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [tipo, setTipo] = useState<Papel>("professor");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!carregando && session && papel) {
      void navigate({ to: papel === "professor" ? "/professor" : "/aluno" });
    }
  }, [carregando, session, papel, navigate]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      if (modo === "criar") {
        const { error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { nome, role: tipo },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Bem-vindo ao Ideon.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        toast.success("Bom te ver de novo.");
      }
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível continuar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
      <div className="pointer-events-none absolute -top-24 right-10 size-96 rounded-full bg-aura/15 blur-3xl aura-pulse" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 size-80 rounded-full bg-nova/10 blur-3xl aura-pulse" />

      <div className="relative w-full max-w-md rounded-[2rem] glass-panel p-8 md:p-10">
        <Logo />
        <h1 className="text-display mt-8 text-3xl">
          {modo === "criar" ? "Criar conta" : "Entrar"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A aula não termina quando o sinal toca.
        </p>

        <form onSubmit={enviar} className="mt-8 space-y-4">
          {modo === "criar" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    { valor: "professor", rotulo: "Professor", icone: GraduationCap },
                    { valor: "aluno", rotulo: "Aluno", icone: Users },
                  ] as const
                ).map((opcao) => (
                  <button
                    key={opcao.valor}
                    type="button"
                    onClick={() => setTipo(opcao.valor)}
                    className={`flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition ${
                      tipo === opcao.valor
                        ? "border-aura/40 bg-aura/10 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <opcao.icone className="size-4" />
                    <span className="text-sm font-semibold">{opcao.rotulo}</span>
                  </button>
                ))}
              </div>
              <Campo rotulo="Nome" valor={nome} aoMudar={setNome} obrigatorio />
            </>
          ) : null}

          <Campo rotulo="E-mail" tipo="email" valor={email} aoMudar={setEmail} obrigatorio />
          <Campo rotulo="Senha" tipo="password" valor={senha} aoMudar={setSenha} obrigatorio />

          <button
            type="submit"
            disabled={enviando}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-aura py-4 text-sm font-bold text-primary-foreground shadow-[var(--shadow-aura)] transition hover:opacity-90 disabled:opacity-60"
          >
            {enviando ? <Loader2 className="size-4 animate-spin" /> : null}
            {modo === "criar" ? "Criar conta" : "Entrar"}
          </button>
        </form>

        <button
          onClick={() => setModo(modo === "criar" ? "entrar" : "criar")}
          className="mt-6 w-full text-center text-sm text-muted-foreground transition hover:text-foreground"
        >
          {modo === "criar" ? "Já tenho conta — entrar" : "Não tenho conta — criar"}
        </button>
      </div>
    </div>
  );
}

function Campo({
  rotulo,
  valor,
  aoMudar,
  tipo = "text",
  obrigatorio,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  tipo?: string;
  obrigatorio?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {rotulo}
      </span>
      <input
        type={tipo}
        required={obrigatorio}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-input bg-background/40 px-4 py-3 text-sm outline-none transition focus:border-aura/50"
      />
    </label>
  );
}
