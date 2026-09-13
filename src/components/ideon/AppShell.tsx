import { Link } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "./Logo";
import { useAuth } from "@/hooks/useAuth";

type ItemNav = { rotulo: string; para: "/" | "/professor" | "/aluno" | "/saude-mental" };

export function AppShell({
  children,
  nav = [],
  ativo,
}: {
  children: ReactNode;
  nav?: ItemNav[];
  ativo?: string;
}) {
  const { perfil, papel, sair } = useAuth();
  const navegacao: ItemNav[] = nav.some((item) => item.para === "/saude-mental")
    ? nav
    : [...nav, { rotulo: "Saúde mental", para: "/saude-mental" }];

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -top-24 right-10 size-96 rounded-full bg-aura/15 blur-3xl aura-pulse" />
      <div
        className="pointer-events-none absolute bottom-0 -left-24 size-80 rounded-full bg-nova/10 blur-3xl aura-pulse"
        style={{ animationDelay: "3s" }}
      />

      <header className="relative mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-6 md:px-8">
        <Link to="/">
          <Logo />
        </Link>
        <nav className="order-3 flex w-full items-center gap-2 overflow-x-auto text-sm text-muted-foreground md:order-none md:w-auto">
          {navegacao.map((item) => (
            <Link
              key={item.para}
              to={item.para}
              aria-current={ativo === item.para ? "page" : undefined}
              className={`shrink-0 rounded-xl px-4 py-2 transition ${
                ativo === item.para
                  ? "border border-nova/20 bg-nova/10 font-semibold text-nova"
                  : "hover:bg-foreground/5 hover:text-foreground"
              }`}
            >
              {item.rotulo}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium">{perfil?.nome ?? "Visitante"}</p>
            <p className="text-[11px] capitalize text-muted-foreground">{papel ?? ""}</p>
          </div>
          <div className="grid size-10 place-items-center rounded-full bg-secondary text-sm font-semibold ring-1 ring-aura/30">
            {(perfil?.nome ?? "?").slice(0, 2).toUpperCase()}
          </div>
          <button
            onClick={() => void sair()}
            aria-label="Sair"
            className="grid size-10 place-items-center rounded-full border border-border text-muted-foreground transition hover:text-foreground"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 py-10 md:px-8 md:py-12">{children}</main>
    </div>
  );
}
