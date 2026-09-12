import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useAuth, type Papel } from "@/hooks/useAuth";

export function Protegido({ papel, children }: { papel: Papel; children: ReactNode }) {
  const { session, papel: papelAtual, carregando } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (carregando) return;
    if (!session) {
      void navigate({ to: "/auth" });
      return;
    }
    if (papelAtual && papelAtual !== papel) {
      void navigate({ to: papelAtual === "professor" ? "/professor" : "/aluno" });
    }
  }, [carregando, session, papelAtual, papel, navigate]);

  if (carregando || !session || papelAtual !== papel) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-aura" />
      </div>
    );
  }

  return <>{children}</>;
}
