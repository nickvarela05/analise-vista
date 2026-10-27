import { z } from "zod";

export const resumoDiarioTogglePayloadSchema = z.object({
  userId: z.string().uuid(),
  ativo: z.boolean(),
});

export const resumoDiarioBulkPayloadSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  ativo: z.boolean(),
});
