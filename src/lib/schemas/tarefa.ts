import { z } from "zod";
import { emptyToNull, isRealDate } from "./_helpers";
import { WORKFLOW, PRIO } from "@/components/tarefas/lib/workflow";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const tarefaSchema = z
  .object({
    titulo: z
      .string()
      .trim()
      .min(1, "Informe um título")
      .max(200, "Título deve ter no máximo 200 caracteres"),
    descricao: z.preprocess(
      emptyToNull,
      z
        .string()
        .max(5000, "Descrição deve ter no máximo 5000 caracteres")
        .nullable(),
    ),
    prioridade: z.enum(PRIO),
    status: z.enum(WORKFLOW),
    data_prevista: z.preprocess(
      emptyToNull,
      z
        .string()
        .regex(DATE_RE, "Data prevista inválida")
        .refine(isRealDate, "Data prevista inexistente")
        .nullable(),
    ),
    responsaveis_ids: z.array(z.string().uuid("Responsável inválido")),
    equipe_toda: z.boolean(),
    demanda_id: z.string().uuid("Demanda inválida").nullable(),
    em_teste: z.boolean(),
  })
  .superRefine((val, ctx) => {
    if (!val.equipe_toda && val.responsaveis_ids.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["responsaveis_ids"],
        message: "Selecione ao menos 1 responsável ou marque equipe toda",
      });
    }
  });

export type TarefaInput = z.infer<typeof tarefaSchema>;
