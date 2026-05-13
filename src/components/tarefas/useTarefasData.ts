import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queries/keys";
import type { TarefaRow } from "@/lib/db-types";

export type CountsMap = Record<
  string,
  { comentarios: number; checklistTotal: number; checklistDone: number; anexos: number }
>;

export type ColabMini = { id: string; nome: string; cargo: string | null };
export type DemandaMini = { id: string; titulo: string };
export type LoteMini = { id: string; nome: string; tipo: string; total_tarefas: number; created_at: string };

/**
 * Centraliza as queries da página de Tarefas.
 * Mantém as mesmas queryKeys (`qk.tarefas.*`) para preservar invalidations existentes.
 */
export function useTarefasData() {
  const { data: colabs = [] } = useQuery<ColabMini[]>({
    queryKey: qk.tarefas.colabs(),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaborador")
        .select("id, nome, cargo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as ColabMini[];
    },
  });

  const { data: demandas = [] } = useQuery<DemandaMini[]>({
    queryKey: qk.tarefas.demandasMini(),
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("demanda")
        .select("id, titulo")
        .order("created_at", { ascending: false });
      return (data ?? []) as DemandaMini[];
    },
  });

  const { data: tarefas = [], isLoading } = useQuery<TarefaRow[]>({
    queryKey: qk.tarefas.all(),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("todo")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TarefaRow[];
    },
  });

  const { data: countsRaw = { coments: [], checks: [], anexos: [] } } = useQuery({
    queryKey: qk.tarefas.counts(),
    staleTime: 30_000,
    queryFn: async () => {
      const [coments, checks, anexos] = await Promise.all([
        supabase.from("todo_comentario").select("todo_id"),
        supabase.from("todo_checklist").select("todo_id, concluido"),
        supabase.from("todo_anexo").select("todo_id"),
      ]);
      return {
        coments: coments.data ?? [],
        checks: checks.data ?? [],
        anexos: anexos.data ?? [],
      };
    },
  });

  const countsMap = React.useMemo<CountsMap>(() => {
    const m: CountsMap = {};
    const ensure = (id: string) => {
      m[id] = m[id] ?? { comentarios: 0, checklistTotal: 0, checklistDone: 0, anexos: 0 };
      return m[id];
    };
    countsRaw.coments.forEach((c: { todo_id: string }) => {
      ensure(c.todo_id).comentarios++;
    });
    countsRaw.checks.forEach((c: { todo_id: string; concluido: boolean | null }) => {
      const e = ensure(c.todo_id);
      e.checklistTotal++;
      if (c.concluido) e.checklistDone++;
    });
    countsRaw.anexos.forEach((a: { todo_id: string }) => {
      ensure(a.todo_id).anexos++;
    });
    return m;
  }, [countsRaw]);

  return { colabs, demandas, tarefas, isLoading, countsMap };
}
