import * as React from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
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

// Colunas usadas pelo Kanban / Lista / filtros. Evita `select('*')` e reduz payload.
const TAREFA_COLUMNS =
  "id,titulo,descricao,status,prioridade,em_teste,equipe_toda,data_prevista,concluida_em,demanda_id,origem_importacao,lote_importacao_id,responsavel_id,responsaveis_ids,criado_por,created_at,updated_at";

/**
 * Centraliza as queries da página de Tarefas.
 *
 * Otimizações:
 *  - Não roda mais o UPDATE de auto-encerramento dentro do queryFn (movido para a RPC
 *    `auto_encerrar_tarefas_antigas`, chamada em background depois do primeiro render).
 *  - Projeta apenas as colunas usadas pelo card/lista.
 *  - Exclui tarefas encerradas do fetch principal (filtro de UI carrega sob demanda).
 *  - `placeholderData: keepPreviousData` evita spinner ao voltar para a rota.
 *  - Contagens (comentários/checklist/anexos) vêm de uma única RPC agregada.
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
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("demanda")
        .select("id, titulo")
        .order("created_at", { ascending: false });
      return (data ?? []) as DemandaMini[];
    },
  });

  const { data: lotes = [] } = useQuery<LoteMini[]>({
    queryKey: ["tarefas", "lotes"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("todo_importacao_lote")
        .select("id, nome, tipo, total_tarefas, created_at")
        .order("created_at", { ascending: false });
      return (data ?? []) as LoteMini[];
    },
  });

  const { data: tarefas = [], isLoading } = useQuery<TarefaRow[]>({
    queryKey: qk.tarefas.all(),
    staleTime: 2 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      // Paginação manual para superar o limite padrão de 1000 linhas do PostgREST.
      const pageSize = 1000;
      const all: TarefaRow[] = [];
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("todo")
          .select(TAREFA_COLUMNS)
          .neq("status", "encerrada")
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const rows = (data ?? []) as TarefaRow[];
        all.push(...rows);
        if (rows.length < pageSize) break;
      }
      return all;
    },
  });

  // Auto-encerramento de tarefas com mais de 5 meses: dispara em background,
  // sem bloquear o render inicial. A RPC só é chamada uma vez por sessão.
  const autoEncerrouRef = React.useRef(false);
  React.useEffect(() => {
    if (autoEncerrouRef.current) return;
    if (isLoading) return;
    autoEncerrouRef.current = true;
    // Fire-and-forget; falha silenciosa (não-crítico).
    setTimeout(() => {
      // @ts-expect-error RPC criada por migração; tipos ainda não regenerados
      supabase.rpc("auto_encerrar_tarefas_antigas").then(() => {});
    }, 1500);
  }, [isLoading]);

  const { data: countsMap = {} } = useQuery<CountsMap>({
    queryKey: qk.tarefas.counts(),
    staleTime: 2 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      // @ts-expect-error RPC criada por migração; tipos ainda não regenerados
      const { data, error } = await supabase.rpc("get_tarefa_counts");
      if (error) throw error;
      const m: CountsMap = {};
      type Row = {
        todo_id: string;
        comentarios: number;
        checklist_total: number;
        checklist_done: number;
        anexos: number;
      };
      for (const r of (data ?? []) as Row[]) {
        m[r.todo_id] = {
          comentarios: Number(r.comentarios) || 0,
          checklistTotal: Number(r.checklist_total) || 0,
          checklistDone: Number(r.checklist_done) || 0,
          anexos: Number(r.anexos) || 0,
        };
      }
      return m;
    },
  });

  return { colabs, demandas, tarefas, lotes, isLoading, countsMap };
}
