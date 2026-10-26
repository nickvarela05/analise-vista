import { z } from "zod";

/** Formulário de processo anual. Em arquivo próprio para o zod não entrar no pacote principal
 * (no topo de uma rota, o separador de telas deixava a regra junto da declaração da rota). */
export const processoSchema = z
  .object({
    nome: z.string().trim().min(1, "Informe um nome").max(200),
    descricao: z.string().max(2000).nullable(),
    cor: z.enum(["indigo", "sky", "emerald", "violet", "amber", "rose", "cyan", "primary"]),
    previsto_inicio: z.string().nullable(),
    previsto_fim: z.string().nullable(),
    real_inicio: z.string().nullable(),
    real_fim: z.string().nullable(),
    responsaveis_ids: z.array(z.string().uuid()),
    equipe_toda: z.boolean(),
    status: z.enum(["planejado", "em_andamento", "concluido", "atrasado"]),
    alerta_dias_antes: z.number().int().min(0).max(365),
    observacoes: z.string().max(3000).nullable(),
  })
  .refine((v) => !v.previsto_inicio || !v.previsto_fim || v.previsto_fim >= v.previsto_inicio, {
    message: "Fim previsto não pode ser antes do início",
    path: ["previsto_fim"],
  })
  .refine((v) => !v.real_inicio || !v.real_fim || v.real_fim >= v.real_inicio, {
    message: "Fim real não pode ser antes do início",
    path: ["real_fim"],
  });
