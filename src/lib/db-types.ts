/**
 * Aliases de Row tipados a partir do schema gerado pelo Supabase.
 * Use em lugar de `any[]` ao trafegar registros entre componentes.
 */
import type { Database } from "@/integrations/supabase/types";

type T = Database["public"]["Tables"];

export type TarefaRow = T["todo"]["Row"];
export type DemandaRow = T["demanda"]["Row"];
export type ReuniaoRow = T["reuniao"]["Row"];
export type AvisoRow = T["aviso_gestor"]["Row"];
