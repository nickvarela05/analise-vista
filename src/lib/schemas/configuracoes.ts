/**
 * @module lib/schemas/configuracoes
 * @description Schema #12 — validação centralizada dos formulários de
 *   Configurações: prompt da IA (`ConfiguracoesIA`) e preferências de
 *   notificação por evento/canal (`PreferenciasNotificacao`).
 */
import { z } from "zod";
import { emptyToNull } from "./_helpers";

// ---------- IA · Análise de reunião ----------

export const IA_CHAVE_ANALISE_REUNIAO = "analise_reuniao" as const;

export const iaPromptConfigSchema = z.object({
  chave: z.literal(IA_CHAVE_ANALISE_REUNIAO),
  prompt_sistema: z
    .string()
    .trim()
    .min(1, { message: "O prompt principal não pode ficar vazio" })
    .max(8000, { message: "Prompt muito longo (máx. 8000 caracteres)" }),
  instrucoes_extras: z.preprocess(
    emptyToNull,
    z
      .string()
      .max(4000, { message: "Instruções extras muito longas (máx. 4000 caracteres)" })
      .nullable(),
  ),
  ativo: z.boolean(),
});

export type IaPromptConfig = z.infer<typeof iaPromptConfigSchema>;

// ---------- Preferências de notificação ----------

export const EVENTOS_TIPOS = [
  "tarefa_atribuida",
  "tarefa_prazo",
  "tarefa_comentario",
  "tarefa_status",
  "demanda_atribuida",
  "demanda_urgente",
  "chamado_sla",
  "aviso_critico",
] as const;

export type EventoTipo = (typeof EVENTOS_TIPOS)[number];

export const CANAIS_NOTIF = ["in_app", "email"] as const;
export type CanalNotif = (typeof CANAIS_NOTIF)[number];

export const notifPreferenciaSchema = z.object({
  user_id: z.string().uuid({ message: "user_id inválido" }),
  evento: z.enum(EVENTOS_TIPOS),
  canal: z.enum(CANAIS_NOTIF),
  ativo: z.boolean(),
});

export type NotifPreferencia = z.infer<typeof notifPreferenciaSchema>;
