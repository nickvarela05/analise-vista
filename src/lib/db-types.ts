/**
 * Aliases de Row tipados a partir do schema gerado pelo Supabase.
 * Use em lugar de `any[]` ao trafegar registros entre componentes.
 */
import type { Database } from "@/integrations/supabase/types";

type T = Database["public"]["Tables"];

export type TarefaRow = T["todo"]["Row"];
export type DemandaRow = T["demanda"]["Row"];
export type ReuniaoRow = T["reuniao"]["Row"];
export type ChamadoRow = T["chamado_externo"]["Row"];
export type ColaboradorRow = T["colaborador"]["Row"];
export type ColaboradorHorarioRow = T["colaborador_horario"]["Row"];
export type ColaboradorFeriasRow = T["colaborador_ferias"]["Row"];
export type AvisoRow = T["aviso_gestor"]["Row"];
export type ProfileRow = T["profiles"]["Row"];

/** Subset comum a tarefa/demanda/reuniao/chamado para regras de atribuição. */
export type AtribuivelComum = {
  id: string;
  equipe_toda?: boolean | null;
  responsaveis_ids?: string[] | null;
  responsavel_id?: string | null;
  status?: string | null;
  prioridade?: string | null;
  titulo?: string | null;
};
