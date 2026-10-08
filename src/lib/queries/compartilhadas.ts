// Consultas usadas por mais de uma tela (Central, Painel da gestão). Mesmas `queryKey` de antes,
// para manter o cache e as invalidações que outras telas já fazem.
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queries/keys";
import { listSolicitacoesRelatorios } from "@/lib/n8n-db.functions";
import type { AvisoRow, ReuniaoRow } from "@/lib/db-types";

export const meuProfileQuery = (userId: string | undefined | null) =>
  queryOptions({
    queryKey: qk.meuProfile(userId),
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("colaborador_id, nome")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const reunioesQuery = () =>
  queryOptions({
    queryKey: qk.dash.reunioes(),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("reuniao").select("*").order("data_reuniao");
      if (error) throw error;
      return (data ?? []) as ReuniaoRow[];
    },
  });

export const avisosAtivosQuery = () =>
  queryOptions({
    queryKey: qk.dash.avisos(),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aviso_gestor")
        .select("*")
        .eq("ativo", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AvisoRow[];
    },
  });

/**
 * Mesma chave e mesmo formato da tela Relatórios, que invalida esta chave ao editar: a Central e o
 * Painel veem a mudança sem esperar o cache vencer.
 */
export const solicitacoesRelatoriosQuery = () =>
  queryOptions({
    queryKey: qk.relatorios.solicitacoes(),
    staleTime: 30_000,
    queryFn: () => listSolicitacoesRelatorios(),
    select: (r) => (r.ok ? r.rows : []),
  });

/** Relatórios inativados manualmente (ids): ficam fora das contagens de pendentes. */
export const relatoriosInativosQuery = () =>
  queryOptions({
    queryKey: qk.relatorios.inativos(),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("relatorio_inativo").select("solicitacao_id");
      if (error) throw error;
      return (data ?? []).map((r: { solicitacao_id: string }) => r.solicitacao_id);
    },
  });
