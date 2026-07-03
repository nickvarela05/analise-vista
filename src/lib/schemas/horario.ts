import { z } from "zod";

const TIME_RE = /^\d{2}:\d{2}$/;

export const horarioSchema = z
  .object({
    colaborador_id: z.string().uuid("Selecione um colaborador"),
    expediente_inicio: z.string().regex(TIME_RE, "Hora inválida (HH:mm)"),
    expediente_fim: z.string().regex(TIME_RE, "Hora inválida (HH:mm)"),
    almoco_inicio: z.string().regex(TIME_RE, "Hora inválida (HH:mm)"),
    almoco_fim: z.string().regex(TIME_RE, "Hora inválida (HH:mm)"),
    local_almoco: z.enum(["Copa", "Fora"]),
  })
  .superRefine((val, ctx) => {
    if (val.expediente_inicio >= val.expediente_fim) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expediente_inicio"],
        message: "Início do expediente deve ser antes do fim",
      });
    }
    if (val.almoco_inicio >= val.almoco_fim) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["almoco_inicio"],
        message: "Início do almoço deve ser antes do fim",
      });
    }
    if (val.almoco_inicio < val.expediente_inicio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["almoco_inicio"],
        message: "Almoço deve começar durante o expediente",
      });
    }
    if (val.almoco_fim > val.expediente_fim) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["almoco_fim"],
        message: "Almoço deve terminar durante o expediente",
      });
    }
  });

export type HorarioInput = z.infer<typeof horarioSchema>;
