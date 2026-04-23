import type { Database } from "@/integrations/supabase/types";

export type EventoTipo = Database["public"]["Enums"]["evento_tipo"];

export interface Horario {
  id: string;
  colaborador_id: string;
  dia_semana: number;
  expediente_inicio: string | null;
  expediente_fim: string | null;
  almoco_inicio: string | null;
  almoco_fim: string | null;
  local_almoco: string | null;
}

export interface Ferias {
  id: string;
  colaborador_id: string;
  data_inicio: string;
  data_fim: string;
  observacao: string | null;
}

export interface Evento {
  id: string;
  colaborador_id: string;
  tipo: EventoTipo;
  data: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  observacao: string | null;
  anexo_url: string | null;
}

export interface Colaborador {
  id: string;
  nome: string;
  cargo: string | null;
  email: string | null;
  bio: string | null;
  foto_url: string | null;
  ativo: boolean;
  ordem: number;
  colaborador_horario: Horario[];
  colaborador_ferias: Ferias[];
  colaborador_evento: Evento[];
}

export const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

export const EVENTO_LABEL: Record<EventoTipo, string> = {
  folga: "Folga",
  falta: "Falta",
  atestado: "Atestado",
  atraso: "Atraso",
  ferias_avulso: "Férias (1 dia)",
};

export type StatusKey =
  | "trabalhando"
  | "almoco"
  | "ferias"
  | "evento"
  | "fora";

export const STATUS_LABEL: Record<StatusKey, string> = {
  trabalhando: "Trabalhando",
  almoco: "Em almoço",
  ferias: "Férias",
  evento: "Indisponível",
  fora: "Fora do expediente",
};
