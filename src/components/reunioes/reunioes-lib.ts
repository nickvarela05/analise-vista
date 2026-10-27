import { supabase } from "@/integrations/supabase/client";
import type { ReuniaoRow } from "@/lib/db-types";

// A lista não baixa a transcrição (quase todo o peso da tabela): ela vem só ao abrir a reunião.
export const COLUNAS_LISTA =
  "id, titulo, tipo, status, data_reuniao, duracao_min, pauta, resumo, proximos_passos, decisoes, participantes, participantes_detectados, link_calendario, responsavel_id, responsaveis_ids, equipe_toda, audio_path, audio_size, audio_mime, criado_por, created_at, updated_at, transcricao_status, transcricao_erro, transcricao_partes_feitas, transcricao_partes_total, transcricao_rodadas";

export type ReuniaoLista = Omit<ReuniaoRow, "transcricao"> & { temTranscricao: boolean };

export const transcricaoQuery = (id: string) => ({
  queryKey: ["reuniao-transcricao", id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("reuniao")
      .select("transcricao")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data.transcricao ?? "";
  },
});

export const TIPOS = ["interna", "cliente", "fornecedor", "alinhamento", "outro"] as const;
export const STATUS = ["agendada", "realizada", "cancelada"] as const;

export type FormState = {
  titulo: string;
  tipo: (typeof TIPOS)[number];
  status: (typeof STATUS)[number];
  data_reuniao: string;
  duracao_min: number;
  pauta: string;
  resumo: string;
  proximos_passos: string;
  transcricao: string;
  link_calendario: string;
  participantes_str: string;
  responsaveis_ids: string[];
  equipe_toda: boolean;
};

export const emptyForm = (): FormState => ({
  titulo: "",
  tipo: "interna",
  status: "agendada",
  data_reuniao: new Date().toISOString().slice(0, 16),
  duracao_min: 60,
  pauta: "",
  resumo: "",
  proximos_passos: "",
  transcricao: "",
  link_calendario: "",
  participantes_str: "",
  responsaveis_ids: [],
  equipe_toda: false,
});

export function statusBadgeClass(s: string) {
  if (s === "agendada") return "bg-info/15 text-info border-info/30";
  if (s === "realizada") return "bg-success/15 text-success border-success/30";
  if (s === "cancelada") return "bg-destructive/15 text-destructive border-destructive/30";
  return "";
}

export const REUNIAO_TONE: Record<string, { accent: string; statusBadge: string; dot: string }> = {
  agendada: {
    accent: "bg-sky-500/70",
    statusBadge: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  realizada: {
    accent: "bg-emerald-500/70",
    statusBadge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  cancelada: {
    accent: "bg-rose-500/70",
    statusBadge: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
  },
};
