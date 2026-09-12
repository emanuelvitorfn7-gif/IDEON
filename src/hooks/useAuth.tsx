import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Papel = "professor" | "aluno";

export type Perfil = {
  id: string;
  nome: string;
  xp: number;
  nivel: number;
  sequencia: number;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  perfil: Perfil | null;
  papel: Papel | null;
  carregando: boolean;
  recarregarPerfil: () => Promise<void>;
  sair: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [papel, setPapel] = useState<Papel | null>(null);
  const [carregando, setCarregando] = useState(true);

  async function carregarDados(userId: string) {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("id, nome, xp, nivel, sequencia").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    ]);
    setPerfil(p ?? null);
    setPapel((r?.role as Papel | undefined) ?? null);
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, novaSessao) => {
      setSession(novaSessao);
      if (novaSessao?.user) {
        setTimeout(() => void carregarDados(novaSessao.user.id), 0);
      } else {
        setPerfil(null);
        setPapel(null);
      }
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) await carregarDados(data.session.user.id);
      setCarregando(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    perfil,
    papel,
    carregando,
    recarregarPerfil: async () => {
      if (session?.user) await carregarDados(session.user.id);
    },
    sair: async () => {
      await supabase.auth.signOut();
      setPerfil(null);
      setPapel(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return ctx;
}
