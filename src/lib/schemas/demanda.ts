import { z } from "zod";
import {
  CATEGORIA_OPTS,
  ORIGEM_OPTS,
  PRIORIDADE_OPTS,
} from "@/components/demandas/lib/demanda-utils";

const emptyToNull = (v: unknown) =>
  typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v ?? null;

const nullableTrimmed = (max: number) =>
  z.preprocess(emptyToNull, z.string().max(max).nullable());

const isRealDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
};

export const demandaSchema = z
  .object({
    id: z.string().uuid().optional(),
    titulo: z
      .string()
      .trim()
      .min(3, "Título deve ter ao menos 3 caracteres")
      .max(200, "Título deve ter no máximo 200 caracteres"),
    descricao: nullableTrimmed(5000),
    origem: z.enum(ORIGEM_OPTS),
    categoria: z.enum(CATEGORIA_OPTS),
    prioridade: z.enum(PRIORIDADE_OPTS),
    solicitante: nullableTrimmed(120),
    responsaveis_ids: z.array(z.string().uuid()).default([]),
    equipe_toda: z.boolean().default(false),
    prazo: z
      .preprocess(
        (v) => (typeof v === "string" && v.trim() === "" ? null : v ?? null),
        z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
          .refine(isRealDate, "Data inexistente")
          .nullable(),
      )
      .optional(),
    tags: z
      .array(z.string().trim().min(1).max(40, "Tag muito longa (máx. 40)"))
      .max(20, "Máximo de 20 tags")
      .default([]),
  })
  .superRefine((v, ctx) => {
    if (!v.equipe_toda && v.responsaveis_ids.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["responsaveis_ids"],
        message: "Selecione ao menos um responsável ou marque 'equipe toda'",
      });
    }
  });

export type DemandaInput = z.infer<typeof demandaSchema>;
