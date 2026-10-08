import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Quando cada tarefa entrou em Pré-build pela última vez, segundo o histórico.
 * A chave começa com "tarefas" para ser invalidada junto pelo realtime de `todo`.
 */
export function useEntradasPreBuild(ids: readonly string[]) {
  const ordenados = [...ids].sort();
  return useQuery({
    queryKey: ["tarefas", "entradas-pre-build", ordenados],
    enabled: ordenados.length > 0,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("todo_historico")
        .select("todo_id, created_at")
        .eq("campo", "status")
        .eq("valor_novo", "pre_build")
        .in("todo_id", ordenados)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const entradas: Record<string, string> = {};
      for (const r of data ?? []) entradas[r.todo_id] ??= r.created_at;
      return entradas;
    },
  });
}
