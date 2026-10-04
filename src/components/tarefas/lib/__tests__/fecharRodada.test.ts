import { describe, it, expect } from "vitest";
import {
  montarHtmlEmail,
  montarLinhas,
  montarTextoEmail,
  tituloSemNumero,
  type TarefaEnvio,
} from "../fecharRodada";

const base: Omit<TarefaEnvio, "id" | "titulo" | "status"> = {
  sistema: "GED",
  data_homologacao: "2026-09-18",
  lote_importacao_id: "L1",
  responsavel_id: null,
  responsaveis_ids: [],
  equipe_toda: false,
};

const tarefas: TarefaEnvio[] = [
  { ...base, id: "a", titulo: "Tarefa 9412 - Customizar a migração de afastamento", status: "aprovado_ressalvas", responsaveis_ids: ["c1"] },
  { ...base, id: "b", titulo: "Tarefa 9361 - Relação Geral dos <Inscritos>", status: "aprovado", responsaveis_ids: ["c1", "c2"] },
  { ...base, id: "c", titulo: "9083 - Painel educação", status: "aprovado", sistema: "BI", responsavel_id: "c2" },
];
const colabs = new Map([
  ["c1", "Matheus Nogueira"],
  ["c2", "Hugo Santos"],
]);
const lotes = new Map([["L1", "HML – 03/10/2026"]]);

describe("tituloSemNumero", () => {
  it("tira o número do começo, nos formatos usados no Nexus", () => {
    expect(tituloSemNumero("Tarefa 9412 - Customizar")).toBe("Customizar");
    expect(tituloSemNumero("9219 - [REUNIÃO] Ajustar")).toBe("[REUNIÃO] Ajustar");
    expect(tituloSemNumero("Sem número no título")).toBe("Sem número no título");
  });
});

describe("montarLinhas", () => {
  const linhas = montarLinhas(tarefas, colabs, lotes, { a: "  Falta o filtro por data  " });

  it("ordena aprovadas antes das com ressalvas e, dentro do grupo, por número", () => {
    expect(linhas.map((l) => l.numero)).toEqual(["9083", "9361", "9412"]);
  });

  it("junta responsável principal e lista de responsáveis, sem repetir", () => {
    expect(linhas.find((l) => l.numero === "9361")!.responsaveis).toBe("Matheus Nogueira, Hugo Santos");
    expect(linhas.find((l) => l.numero === "9083")!.responsaveis).toBe("Hugo Santos");
  });

  it("leva observação (sem espaços sobrando), data e lote", () => {
    expect(linhas.find((l) => l.numero === "9412")).toMatchObject({
      observacao: "Falta o filtro por data",
      dataHml: "18/09/2026",
      lote: "HML – 03/10/2026",
      statusLabel: "Aprovado c/ ressalvas",
    });
  });
});

describe("montarHtmlEmail", () => {
  const linhas = montarLinhas(tarefas, colabs, lotes, {});
  const html = montarHtmlEmail("Bom dia, prezados,\n\nSegue a situação.", linhas, "Atenciosamente,");

  it("separa os grupos com a contagem", () => {
    expect(html).toContain("Aprovadas (2)");
    expect(html).toContain("Aprovadas com ressalvas (1)");
  });

  it("escapa o texto das tarefas", () => {
    expect(html).toContain("Relação Geral dos &lt;Inscritos&gt;");
    expect(html).not.toContain("<Inscritos>");
  });

  it("usa estilo na própria tag, que o Outlook mantém ao colar", () => {
    expect(html).toMatch(/<td style="[^"]*border:1px solid/);
    expect(html).not.toContain("<style");
  });

  it("omite o grupo vazio", () => {
    const so = montarHtmlEmail("Oi", linhas.filter((l) => l.status === "aprovado"), "");
    expect(so).not.toContain("ressalvas");
  });
});

describe("montarTextoEmail", () => {
  it("lista cada tarefa com sistema, responsáveis e observação", () => {
    const linhas = montarLinhas(tarefas, colabs, lotes, { a: "Falta filtro" });
    const t = montarTextoEmail("Bom dia", linhas, "");
    expect(t).toContain("- 9412 Customizar a migração de afastamento (GED · teste: Matheus Nogueira · obs.: Falta filtro)");
  });
});
