import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ideon/AppShell";
import { Protegido } from "@/components/ideon/Protegido";
import { SaudeMental } from "@/components/ideon/SaudeMental";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/saude-mental")({
  head: () => ({
    meta: [
      { title: "Saúde mental — Ideon" },
      {
        name: "description",
        content: "Um espaço para reconhecer como você se sente, cuidar de si e encontrar apoio.",
      },
    ],
  }),
  component: PaginaSaudeMental,
});

function PaginaSaudeMental() {
  const { papel, user } = useAuth();
  return (
    <Protegido>
      <AppShell
        nav={[{ rotulo: "Painel", para: papel === "professor" ? "/professor" : "/aluno" }]}
        ativo="/saude-mental"
      >
        <SaudeMental key={user?.id} />
      </AppShell>
    </Protegido>
  );
}
