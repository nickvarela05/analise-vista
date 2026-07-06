/** Schemas para criação e convite de usuários. */
import { z } from "zod";

export const ROLES = ["gestor", "analista"] as const;

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email("E-mail inválido")
  .max(200, "E-mail muito longo");

const roleField = z.enum(ROLES).default("analista");

export const criarUsuarioSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, "Nome é obrigatório")
    .max(120, "Nome muito longo"),
  email: emailField,
  role: roleField,
  colaborador_id: z.string().uuid("Colaborador inválido").nullable(),
});

export const convidarUsuarioSchema = z.object({
  email: emailField,
  role: roleField,
});

export type CriarUsuarioInput = z.infer<typeof criarUsuarioSchema>;
export type ConvidarUsuarioInput = z.infer<typeof convidarUsuarioSchema>;
