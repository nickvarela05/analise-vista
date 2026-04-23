import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "gestor" | "analista";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [role, setRole] = React.useState<AppRole | null>(null);
  const [loading, setLoading] = React.useState(true);

  const fetchRole = React.useCallback(async (userId: string) => {
    const { data: gestor } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "gestor")
      .maybeSingle();

    if (gestor?.role === "gestor") {
      setRole("gestor");
      return "gestor" satisfies AppRole;
    }

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .order("role", { ascending: true })
      .limit(1)
      .maybeSingle();

    const nextRole = (data?.role as AppRole) ?? null;
    setRole(nextRole);
    return nextRole;
  }, []);

  React.useEffect(() => {
    let active = true;

    const syncAuth = async (newSession: Session | null) => {
      if (!active) return;

      setSession(newSession);

      if (newSession?.user) {
        setLoading(true);
        await fetchRole(newSession.user.id);
        if (active) setLoading(false);
        return;
      }

      setRole(null);
      setLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      void syncAuth(newSession);
    });

    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      void syncAuth(s);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [fetchRole]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, role, loading, signOut }}
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
