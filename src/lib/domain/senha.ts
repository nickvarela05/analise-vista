/**
 * Regra de senha do Nexus (decisão do Nickolas em 14/10/2026: "Regras: liga").
 * Mesma regra configurada no Supabase Auth (Auth → Providers → Email): mínimo de 8 caracteres,
 * com letra minúscula, letra maiúscula e número. As telas conferem antes de enviar, para a
 * pessoa ver o que falta em vez de um erro do servidor.
 */
export const SENHA_MINIMO = 8;

export const REGRA_SENHA_TEXTO = "Mínimo de 8 caracteres, com letra minúscula, letra maiúscula e número.";

/** O que falta na senha; lista vazia quando ela atende à regra. */
export function problemasSenha(senha: string): string[] {
  const falta: string[] = [];
  if (senha.length < SENHA_MINIMO) falta.push(`pelo menos ${SENHA_MINIMO} caracteres`);
  if (!/[a-z]/.test(senha)) falta.push("uma letra minúscula");
  if (!/[A-Z]/.test(senha)) falta.push("uma letra maiúscula");
  if (!/[0-9]/.test(senha)) falta.push("um número");
  return falta;
}

/** Mensagem pronta: "A senha precisa de: uma letra maiúscula e um número." */
export function mensagemSenha(senha: string): string | null {
  const falta = problemasSenha(senha);
  if (falta.length === 0) return null;
  const lista = falta.length === 1 ? falta[0] : `${falta.slice(0, -1).join(", ")} e ${falta.at(-1)}`;
  return `A senha precisa de ${lista}.`;
}
