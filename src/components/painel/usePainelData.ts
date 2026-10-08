import { useQuery } from "@tanstack/react-query";
import { subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/queries/fetch-all";
import type { EventoStatus } from "./lib/metricas";

/** Janela do histórico lido pelo Painel: cobre as 8 semanas do ritmo e os 90 dias da qualidade. */
export const JANELA_DIAS = 120;

type Linha = {
  todo_id: string;
  valor_antigo: string | null;
  valor_novo: string | null;
  created_at: string;
  todo: { sistema: string | null; created_at: string; origem_importacao: string | null } | null;
};

/**
 * Mudanças de status dos últimos `JANELA_DIAS`, com o sistema da tarefa.
 * Chave sob "tarefas" para o realtime de `todo` invalidar junto.
 */
export function useEventosStatus() {
  return useQuery({
    queryKey: ["tarefas", "painel-eventos", JANELA_DIAS],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<EventoStatus[]> => {
      const desde = subDays(new Date(), JANELA_DIAS).toISOString();
      const rows = await fetchAllRows<Linha>(
        (from, to) =>
          supabase
            .from("todo_historico")
            .select(
              "todo_id, valor_antigo, valor_novo, created_at, todo(sistema, created_at, origem_importacao)",
            )
            .eq("campo", "status")
            .gte("created_at", desde)
            .order("created_at")
            .order("id")
            .range(from, to) as unknown as PromiseLike<{ data: Linha[] | null; error: unknown }>,
      );
      return rows.map((r) => ({
        todo_id: r.todo_id,
        de: r.valor_antigo,
        para: r.valor_novo,
        em: r.created_at,
        sistema: r.todo?.sistema ?? null,
        criadaEm: r.todo?.created_at ?? null,
        origem: r.todo?.origem_importacao ?? null,
      }));
    },
  });
}
