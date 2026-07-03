import { z } from "zod";
import { emptyToNull } from "./_helpers";

export const LOCAL_TRABALHO = ["escritorio", "rua"] as const;

export const colaboradorSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "Nome muito curto (mín. 2)")
    .max(120, "Nome deve ter no máximo 120 caracteres"),
  cargo: z.preprocess(
    emptyToNull,
    z.string().max(80, "Cargo deve ter no máximo 80 caracteres").nullable(),
  ),
  bio: z.preprocess(
    emptyToNull,
    z.string().max(2000, "Bio deve ter no máximo 2000 caracteres").nullable(),
  ),
  local_trabalho: z.enum(LOCAL_TRABALHO).default("escritorio"),
});

export type ColaboradorInput = z.infer<typeof colaboradorSchema>;
