import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queries/keys";
import { COLUNAS_LISTA, type ReuniaoLista } from "@/components/reunioes/reunioes-lib";
import type { Processo } from "@/components/processos/processos-lib";
import type { AvisoRow } from "@/components/avisos/AvisoCard";

/**
 * Consulta principal de cada tela, usada pela própria tela e pelo `loader` da rota, que a
 * pré-carrega quando o mouse passa no link do menu (fase F, 27/10/2026). Fica fora dos
 * arquivos de rota porque o `loader` vai no pacote principal: aqui só entra o necessário.
 */

export const reunioesConsulta = () =>
  queryOptions({
    queryKey: ["reunioes"],
    queryFn: async (): Promise<ReuniaoLista[]> => {
      const [lista, comTranscricao] = await Promise.all([
        supabase.from("reuniao").select(COLUNAS_LISTA).order("data_reuniao", { ascending: false }),
        supabase.from("reuniao").select("id").not("transcricao", "is", null).neq("transcricao", ""),
      ]);
      if (lista.error) throw lista.error;
      if (comTranscricao.error) throw comTranscricao.error;
      const ids = new Set((comTranscricao.data ?? []).map((r) => r.id));
      return (lista.data ?? []).map((r) => ({ ...r, temTranscricao: ids.has(r.id) }));
    },
  });

export const processosDoAnoConsulta = (ano: number) =>
  queryOptions({
    queryKey: ["processos", ano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processo_anual" as never)
        .select("*")
        .eq("ano", ano)
        .order("previsto_inicio", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as Processo[];
    },
  });

export const demandasConsulta = () =>
  queryOptions({
    queryKey: qk.demandas.all(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demanda")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const avisosConsulta = () =>
  queryOptions({
    queryKey: qk.avisos.all(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aviso_gestor")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AvisoRow[];
    },
  });

export const colaboradoresAtivosConsulta = () =>
  queryOptions({
    queryKey: qk.colaboradores(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaborador")
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
