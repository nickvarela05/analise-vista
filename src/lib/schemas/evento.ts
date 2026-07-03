import { z } from "zod";
import { emptyToNull, isRealDate } from "./_helpers";

export const EVENTO_TIPO_OPTS = [
  "folga",
  "falta",
  "atestado",
  "atraso",
  "ferias_avulso",
] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export const eventoSchema = z
  .object({
    colaborador_id: z.string().uuid("Selecione um colaborador"),
    tipo: z.enum(EVENTO_TIPO_OPTS),
    data: z
      .string()
      .regex(DATE_RE, "Data inválida")
      .refine(isRealDate, "Data inexistente"),
    hora_inicio: z.preprocess(
      emptyToNull,
      z
        .string()
        .regex(TIME_RE, "Hora inválida (HH:mm)")
        .nullable(),
    ),
    hora_fim: z.preprocess(
      emptyToNull,
      z
        .string()
        .regex(TIME_RE, "Hora inválida (HH:mm)")
        .nullable(),
    ),
    observacao: z.preprocess(
      emptyToNull,
      z
        .string()
        .max(500, "Observação deve ter no máximo 500 caracteres")
        .nullable(),
    ),
  })
  .superRefine((val, ctx) => {
    if (val.tipo === "atraso") {
      if (!val.hora_inicio) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["hora_inicio"],
          message: "Informe o horário de chegada",
        });
      }
      if (!val.hora_fim) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["hora_fim"],
          message: "Informe o horário esperado",
        });
      }
      if (
        val.hora_inicio &&
        val.hora_fim &&
        !(val.hora_inicio > val.hora_fim)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["hora_inicio"],
          message: "Chegada deve ser após o horário esperado",
        });
      }
    }
  })
  .transform((val) => {
    if (val.tipo !== "atraso") {
      return { ...val, hora_inicio: null, hora_fim: null };
    }
    return val;
  });

export type EventoInput = z.infer<typeof eventoSchema>;
