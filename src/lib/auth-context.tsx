import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "gestor" | "analista";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  mustChangePassword: boolean;
  /** Papel e troca de senha ainda carregando (menu de Gestão, telas só de gestor). */
  loading: boolean;
  /** A sessão já foi lida (com ou sem login). As telas podem começar a buscar dados. */
  sessaoPronta: boolean;
  signOut: () => Promise<void>;
  refreshMustChangePassword: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [role, setRole] = React.useState<AppRole | null>(null);
  const [mustChangePassword, setMustChangePassword] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [sessaoPronta, setSessaoPronta] = React.useState(false);

  // Uma consulta só para o papel (antes eram duas em sequência): gestor ganha de analista.
  const fetchRole = React.useCallback(async (userId: string) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const papeis = (data ?? []).map((r) => r.role as AppRole);
    const nextRole: AppRole | null = papeis.includes("gestor") ? "gestor" : (papeis[0] ?? null);
    setRole(nextRole);
    return nextRole;
  }, []);

  const fetchMustChange = React.useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("must_change_password")
      .eq("user_id", userId)
      .maybeSingle();
    setMustChangePassword(Boolean(data?.must_change_password));
  }, []);

  const refreshMustChangePassword = React.useCallback(async () => {
    if (session?.user) await fetchMustChange(session.user.id);
  }, [session, fetchMustChange]);

  React.useEffect(() => {
    let active = true;
    let initialized = false;
    let lastUserId: string | null = null;
    let lastToken: string | null = null;

    const syncAuth = async (newSession: Session | null, isInitial: boolean) => {
      if (!active) return;

      const nextToken = newSession?.access_token ?? null;
      // Eventos repetidos com a mesma sessão (ex.: tentativas de refresh que falham
      // por rede) não devem reatualizar o estado — isso causava loop de re-render.
      if (!isInitial && nextToken === lastToken) return;
      lastToken = nextToken;

      setSession(newSession);
      // A tela já pode montar e buscar os dados enquanto o papel carrega (23/10/2026): antes ela
      // esperava papel e troca de senha, e só então começava a buscar a Central.
      setSessaoPronta(true);

      if (newSession?.user) {
        const userChanged = lastUserId !== newSession.user.id;
        lastUserId = newSession.user.id;

        // Só mostra spinner global no carregamento inicial ou quando muda de usuário.
        // Refreshes de token (ao voltar para a aba) atualizam role/must_change em segundo plano,
        // sem desmontar a árvore — preservando diálogos abertos e estado de formulários.
        if (isInitial || userChanged) {
          setLoading(true);
          await Promise.all([fetchRole(newSession.user.id), fetchMustChange(newSession.user.id)]);
          if (active) setLoading(false);
        } else {
          void Promise.all([fetchRole(newSession.user.id), fetchMustChange(newSession.user.id)]);
        }
        return;
      }

      lastUserId = null;
      setRole(null);
      setMustChangePassword(false);
      setLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      const isInitial = !initialized;
      initialized = true;
      void syncAuth(newSession, isInitial);
    });

    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (initialized) return; // onAuthStateChange já tratou
      initialized = true;
      void syncAuth(s, true);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [fetchRole, fetchMustChange]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        role,
        mustChangePassword,
        loading,
        sessaoPronta,
        signOut,
        refreshMustChangePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
