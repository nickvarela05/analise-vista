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
  const estagiarioOk = c.includes("estagi") && c.includes("ti");
  return c.includes("analista") || c.includes("gestor") || estagiarioOk;
}
