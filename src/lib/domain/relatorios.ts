/**
 * Regras das solicitações de relatório (fluxo n8n).
 * Mesma regra do antigo funil do Dashboard, que a tela Relatórios também segue.
 */
type Solicitacao = {
  id?: string;
  status: string | null;
  solicitante_nome: string | null;
  solicitante_email?: string | null;
};

const isGoogleSolicitante = (r: Solicitacao) => {
  const nome = (r.solicitante_nome ?? "").toLowerCase();
  const email = (r.solicitante_email ?? "").toLowerCase();
  return nome.includes("google") || /@(.*\.)?google\.com$/.test(email);
};

/**
 * Pendente e ativo: fora os inativados à mão e os do solicitante Google.
 * "Pendente de análise" (status que o n8n grava na entrada) também conta: até 14/10/2026 só a
 * palavra exata "Pendente" contava, e a Central e o Painel ignoravam os que chegavam assim.
 */
export function isRelatorioPendente(r: Solicitacao, inativosIds: ReadonlySet<string>) {
  if (!(r.status ?? "").trim().toLowerCase().startsWith("pendente")) return false;
  if (r.id && inativosIds.has(r.id)) return false;
  return !isGoogleSolicitante(r);
}
