/**
 * Regras puras relacionadas a cargos.
 * Sem dependências de React/Supabase — seguro para testes unitários.
 */

/**
 * Indica se o cargo é elegível para aparecer no gráfico
 * "Atribuições por colaborador".
 *
 * Regra atual:
 * - Inclui qualquer cargo que contenha "analista" ou "gestor".
 * - Entre estagiários, inclui APENAS "Estagiário TI" (não o estagiário comum).
 */
export function cargoElegivel(cargo: string | null | undefined): boolean {
  const c = (cargo ?? "").toLowerCase();
  // "Gerente" é apenas visualizador — nunca elegível para atribuições.
  if (c.includes("gerente")) return false;
  const estagiarioOk = c.includes("estagi") && c.includes("ti");
  return c.includes("analista") || c.includes("gestor") || estagiarioOk;
}

/**
 * Pode receber tarefa (teste de homologação). Decisão do Nickolas em 13/10/2026: só os analistas
 * de requisitos (hoje Nickolas, Hugo, Matheus e Felipe). Gestores e o estagiário usam o Nexus,
 * mas não recebem tarefa nova; atribuições antigas deles continuam valendo e aparecendo.
 */
export function podeReceberTarefa(cargo: string | null | undefined): boolean {
  return (cargo ?? "").toLowerCase().includes("analista");
}

/**
 * Opções de responsável para uma tarefa: os analistas e, para não sumir da tela, quem já está
 * atribuído mesmo sem ser analista.
 */
export function opcoesResponsavel<T extends { id: string; cargo: string | null }>(
  colabs: readonly T[],
  jaAtribuidos: readonly string[] = [],
): T[] {
  const atuais = new Set(jaAtribuidos);
  return colabs.filter((c) => podeReceberTarefa(c.cargo) || atuais.has(c.id));
}
