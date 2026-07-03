import { z } from "zod";
import { emptyToNull, isRealDate, todayISO } from "./_helpers";

export const avisoSchema = z.object({
  titulo: z
    .string()
    .trim()
    .min(3, "Título muito curto (mín. 3)")
    .max(120, "Título deve ter no máximo 120 caracteres"),
  mensagem: z
    .string()
    .trim()
    .min(3, "Mensagem muito curta (mín. 3)")
    .max(1000, "Mensagem deve ter no máximo 1000 caracteres"),
  tipo: z.enum(["informativo", "alerta", "critico"]),
  ativo: z.boolean().default(true),
  destinatarios: z
    .array(z.string().uuid())
    .max(200, "Máximo de 200 destinatários")
    .default([]),
  expira_em: z
    .preprocess(
      emptyToNull,
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
        .refine(isRealDate, "Data inexistente")
        .refine((s) => s >= todayISO(), "Data não pode ser no passado")
        .nullable(),
    )
    .optional(),
});

export type AvisoInput = z.infer<typeof avisoSchema>;
