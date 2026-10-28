// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { parseEmailHomologacao, tabelaHtmlParaTsv } from "../emailHomologacao";

const linha = (...celulas: string[]) => `<tr>${celulas.map((c) => `<td>${c}</td>`).join("")}</tr>`;

// E-mail de 27/10/2026: o bloco de 23/10 veio numa tabela à parte, no meio da principal. Antes
// a leitura ficava só com a maior tabela, e as 6 tarefas de 23/10 não entraram no pacote.
const EMAIL_EM_DUAS_TABELAS = `
<p>Segue as tarefas disponíveis para testes em homologação.</p>
<table>
  ${linha("Data de hml", "Sistema", "Número", "Tarefa", "Observação", "Link")}
  <tr><td rowspan="2">19/10/2026</td><td>GED</td><td>9468</td><td>Criar objeto para o botão novo</td><td></td><td></td></tr>
  ${linha("GED", "9604", "Verificar consulta ao editar cadastro de alunos.", "", '<a href="https://homolog.exemplo/ged-hml-9604">clique aqui</a>')}
</table>
<table>
  <tr><td rowspan="2">23/10/2026</td><td>GED</td><td>9359</td><td>Verificar mensagem em vermelho</td><td></td><td></td></tr>
  ${linha("App - Professor", "9609 ", "Ajuste no fluxo do app do professor", "", "")}
</table>
<table>
  <tr><td rowspan="3">27/10/2026</td><td>GED</td><td>9616</td><td>Verificar consulta de exibição</td><td></td><td></td></tr>
  ${linha("BI", "9602", "Alterar os IDEB's no BI", "", "")}
  ${linha("GED", "9310", "Criar o objeto de permissão", "", "")}
</table>
<table><tr><td>Atenciosamente,<br>Equipe de desenvolvimento</td></tr></table>
`;

describe("tabelaHtmlParaTsv", () => {
  it("junta todas as tabelas de dados do e-mail, na ordem", () => {
    const { itens } = parseEmailHomologacao(tabelaHtmlParaTsv(EMAIL_EM_DUAS_TABELAS)!);
    expect(itens.map((i) => i.numero)).toEqual([
      "9468",
      "9604",
      "9359",
      "9609",
      "9616",
      "9602",
      "9310",
    ]);
  });

  it("mantém data, sistema e link de cada bloco", () => {
    const { itens } = parseEmailHomologacao(tabelaHtmlParaTsv(EMAIL_EM_DUAS_TABELAS)!);
    const por = (n: string) => itens.find((i) => i.numero === n)!;
    expect(por("9604")).toMatchObject({
      dataHml: "2026-10-19",
      link: "https://homolog.exemplo/ged-hml-9604",
    });
    expect(por("9609")).toMatchObject({ dataHml: "2026-10-23", sistema: "App - Professor" });
    expect(por("9310")).toMatchObject({ dataHml: "2026-10-27", sistema: "GED" });
  });

  it("ignora a tabela de layout que envolve as de dados", () => {
    const envolvida = `<table><tr><td>${EMAIL_EM_DUAS_TABELAS}</td></tr></table>`;
    const { itens } = parseEmailHomologacao(tabelaHtmlParaTsv(envolvida)!);
    expect(itens).toHaveLength(7);
  });

  it("devolve null quando o HTML não tem tabela", () => {
    expect(tabelaHtmlParaTsv("<p>9359 Verificar</p>")).toBeNull();
  });
});
