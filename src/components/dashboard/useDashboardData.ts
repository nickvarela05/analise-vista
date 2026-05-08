import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queries/keys";
import { listSolicitacoesRelatorios } from "@/server/n8n-db.functions";
import type {
  TarefaRow,
  DemandaRow,
  ReuniaoRow,
  ChamadoRow,
  AvisoRow,
} from "@/lib/db-types";

/**
 * Centraliza as queries do Dashboard (rota /).
 * Mantém as mesmas queryKeys (`qk.dash.*`) para preservar invalidations.
 */
export function useDashboardData(userId: string | undefined | null) {
  const meuProfile = useQuery({
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

  const chamados = useQuery<ChamadoRow[]>({
    queryKey: qk.dash.chamados(),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("chamado_externo").select("*");
      if (error) throw error;
      return (data ?? []) as ChamadoRow[];
    },
  });

  const tarefas = useQuery<TarefaRow[]>({
    queryKey: qk.dash.tarefas(),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("todo").select("*");
      if (error) throw error;
      return (data ?? []) as TarefaRow[];
    },
  });

  const reunioes = useQuery<ReuniaoRow[]>({
    queryKey: qk.dash.reunioes(),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("reuniao").select("*").order("data_reuniao");
      if (error) throw error;
      return (data ?? []) as ReuniaoRow[];
    },
  });

  const avisos = useQuery<AvisoRow[]>({
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

  const ferias = useQuery({
    queryKey: qk.dash.ferias(),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaborador_ferias")
        .select("*, colaborador(nome, foto_url)")
        .order("data_inicio", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const colaboradores = useQuery({
    queryKey: qk.dash.colaboradores(),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaborador")
        .select("*, colaborador_horario(*)")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });

  const demandas = useQuery<DemandaRow[]>({
    queryKey: qk.dash.demandas(),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("demanda").select("*");
      if (error) throw error;
      return (data ?? []) as DemandaRow[];
    },
  });

  const solicitacoes = useQuery({
    queryKey: qk.dash.solicitacoesRelatorios(),
    staleTime: 30_000,
    queryFn: () => listSolicitacoesRelatorios(),
  });

  return {
    meuProfile: meuProfile.data ?? null,
    chamados: chamados.data ?? [],
    tarefas: tarefas.data ?? [],
    reunioes: reunioes.data ?? [],
    avisos: avisos.data ?? [],
    ferias: ferias.data ?? [],
    colaboradores: colaboradores.data ?? [],
    demandas: demandas.data ?? [],
    solicitacoes: solicitacoes.data?.ok ? solicitacoes.data.rows : [],
    loading: {
      chamados: chamados.isLoading,
      tarefas: tarefas.isLoading,
      reunioes: reunioes.isLoading,
      avisos: avisos.isLoading,
      solicitacoes: solicitacoes.isLoading,
    },
  };
}
