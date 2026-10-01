import { describe, it, expect } from "vitest";
import { parseEmailHomologacao } from "../emailHomologacao";

// Linhas no formato do e-mail de 01/10/2026 (colunas: Data de hml, Sistema, Número, Tarefa,
// Observação, Link), como chegam coladas: células separadas por tabulação.
const EMAIL = [
  "Segue as tarefas disponíveis para testes em homologação.",
  "Data de hml\tSistema\tNúmero\tTarefa\tObservação\tLink",
  "18/09/2026\tBI\t9083\tVerificar o motivo de demorar o carregamento ao trocar os anos\t\t",
  "\tMaed\t9208\tVerificar mensagem no login do usuário MFEDUARDO\t\t",
  "\tGED\t9361\tRealizar adaptações na tela de Relação Geral dos Inscritos na Remoção\t\thttps://homolog-gestaoeducacional.osasco.sp.gov.br/ged-hml-9361/#/",
  "\tGED\t9069\tImplementar funcionalidade de pedir avaliação dentro dos apps\t\t",
  "\tApp - Aluno - Prof\t9069\tImplementar funcionalidade de pedir avaliação dentro dos apps\t\t",
  "25/09/2026\tMAED\t9382\tVerificar consulta de solicitações realizadas no sistema de materiais.\t\t",
  "\t\t8763\tVerificar loading demorado da tela de parametrização de Perfil x Acesso.\t\t",
  "28/09/2026\tGED\t9473\tValidar ficha AF quando editar data-fim na lotação\tVerificação da rotina e verificado que o registro é antigo\t",
].join("\n");

describe("parseEmailHomologacao", () => {
  const { itens, ignoradas } = parseEmailHomologacao(EMAIL);
  const por = (n: string) => itens.find((i) => i.numero === n)!;

  it("lê uma tarefa por número e ignora saudação e cabeçalho", () => {
    expect(itens.map((i) => i.numero)).toEqual(["9083", "9208", "9361", "9069", "9382", "8763", "9473"]);
    expect(ignoradas).toBe(2);
  });

  it("converte a data e a repete nas linhas de célula mesclada", () => {
    expect(por("9083").dataHml).toBe("2026-09-18");
    expect(por("9208").dataHml).toBe("2026-09-18");
    expect(por("9382").dataHml).toBe("2026-09-25");
    expect(por("9473").dataHml).toBe("2026-09-28");
  });

  it("repete o sistema quando a célula vem vazia (mesclada)", () => {
    expect(por("9382").sistema).toBe("MAED");
    expect(por("8763").sistema).toBe("MAED");
  });

  it("separa link, tarefa e observação pelo conteúdo, não pela posição", () => {
    expect(por("9361").link).toBe("https://homolog-gestaoeducacional.osasco.sp.gov.br/ged-hml-9361/#/");
    expect(por("9361").observacao).toBeNull();
    expect(por("9473").observacao).toBe("Verificação da rotina e verificado que o registro é antigo");
    expect(por("9473").link).toBeNull();
    expect(por("9083").tarefa).toContain("Verificar o motivo de demorar");
  });

  it("junta os sistemas quando a mesma tarefa aparece duas vezes", () => {
    expect(por("9069").sistema).toBe("GED / App - Aluno - Prof");
  });

  it("aceita coluna a mais e ordem diferente", () => {
    const r = parseEmailHomologacao("GED\tJoão\t9412\tCustomizar a migração\thttps://x.gov.br/ged-hml-9412/\t18/09/2026");
    expect(r.itens[0]).toMatchObject({
      numero: "9412",
      tarefa: "Customizar a migração",
      link: "https://x.gov.br/ged-hml-9412/",
      dataHml: "2026-09-18",
      observacao: null,
    });
  });

  it("não repete o texto de uma célula que ocupa duas colunas", () => {
    const r = parseEmailHomologacao("28/09/2026	GED	9473	Validar ficha AF	Verificação da rotina	Verificação da rotina");
    expect(r.itens[0].observacao).toBe("Verificação da rotina");
  });

  it("aceita uma lista simples de números", () => {
    const r = parseEmailHomologacao("9083, 9208; 9453\n9361");
    expect(r.itens.map((i) => i.numero)).toEqual(["9083", "9208", "9453", "9361"]);
  });

  it("não cria tarefa a partir de frase solta com número", () => {
    const r = parseEmailHomologacao("Salientamos a necessidade de manter a tarefa 9211 em stand-by.");
    expect(r.itens).toEqual([]);
    expect(r.ignoradas).toBe(1);
  });
});
