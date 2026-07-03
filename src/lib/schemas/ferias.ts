import { z } from "zod";
import { emptyToNull, isRealDate } from "./_helpers";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const feriasSchema = z
  .object({
    colaborador_id: z.string().uuid("Colaborador inválido"),
    data_inicio: z
      .string()
      .regex(DATE_RE, "Data de início inválida")
      .refine(isRealDate, "Data de início inexistente"),
    data_fim: z
      .string()
      .regex(DATE_RE, "Data de fim inválida")
      .refine(isRealDate, "Data de fim inexistente"),
    observacao: z.preprocess(
      emptyToNull,
      z
        .string()
        .max(500, "Observação deve ter no máximo 500 caracteres")
        .nullable(),
    ),
  })
  .superRefine((val, ctx) => {
    if (val.data_inicio > val.data_fim) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["data_fim"],
        message: "Data de fim deve ser igual ou após a data de início",
      });
    }
  });

export type FeriasInput = z.infer<typeof feriasSchema>;
