import { z } from "zod";
import { emptyToNull, isRealDate } from "./_helpers";
import { STATUS_SOLICITACAO } from "@/lib/n8n-db.functions";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const URGENCIAS = ["Baixa", "Média", "Alta", "Crítica"] as const;

export const relatorioSchema = z.object({
  categoria: z
    .string()
    .trim()
    .min(1, "Informe a categoria")
    .max(100, "Categoria deve ter no máximo 100 caracteres"),
  tipo_base: z.preprocess(
    emptyToNull,
    z.string().max(100, "Tipo deve ter no máximo 100 caracteres").nullable(),
  ),
  solicitante_nome: z.preprocess(
    emptyToNull,
    z.string().max(120, "Nome deve ter no máximo 120 caracteres").nullable(),
  ),
  solicitante_email: z.preprocess(
    emptyToNull,
    z
      .string()
      .email("E-mail inválido")
      .max(200, "E-mail deve ter no máximo 200 caracteres")
      .nullable(),
  ),
  descricao: z
    .string()
    .trim()
    .min(1, "Descrição é obrigatória")
    .max(5000, "Descrição deve ter no máximo 5000 caracteres"),
  urgencia: z.enum(URGENCIAS),
  prazo: z.preprocess(
    emptyToNull,
    z
      .string()
      .regex(DATE_RE, "Prazo inválido")
      .refine(isRealDate, "Prazo inexistente")
      .nullable(),
  ),
  responsavel: z.preprocess(
    emptyToNull,
    z.string().max(120, "Responsável deve ter no máximo 120 caracteres").nullable(),
  ),
  status: z.enum(STATUS_SOLICITACAO),
});

export type RelatorioInput = z.infer<typeof relatorioSchema>;
