import { describe, expect, it } from "vitest";
import { agruparStatus, contarLiberacoes, type Mudanca } from "../mudancas";

const m = (
  todo_id: string,
  campo: string,
  para: string | null,
  em: string,
  titulo = `Tarefa ${todo_id}`,
): Mudanca => ({
  todo_id,
  titulo,
  campo,
  para,
  autor: "Felipe",
  em,
});

describe("agruparStatus", () => {
  it("usa a última mudança de cada tarefa e segue a ordem do fluxo", () => {
    const g = agruparStatus([
      m("1", "status", "reprovado", "2026-10-09T10:00:00Z"),
      m("1", "status", "aprovado", "2026-10-09T11:00:00Z"),
      m("2", "status", "pre_build", "2026-10-09T10:00:00Z"),
      m("3", "status", "aprovado", "2026-10-09T09:00:00Z"),
      m("4", "liberacao", "Versão publicada", "2026-10-09T09:00:00Z"),
    ]);
    expect(g.map((x) => [x.rotulo, x.tarefas.map((t) => t.todo_id)])).toEqual([
      ["Aprovado", ["1", "3"]],
      ["Pré-build", ["2"]],
    ]);
  });
});

describe("contarLiberacoes", () => {
  it("conta confirmações e ignora as desfeitas", () => {
    expect(
      contarLiberacoes([
        m("1", "liberacao", "Versão publicada", "2026-10-09T10:00:00Z"),
        m("1", "liberacao", null, "2026-10-09T10:05:00Z"),
        m("2", "status", "aprovado", "2026-10-09T10:00:00Z"),
      ]),
    ).toBe(1);
  });
});
