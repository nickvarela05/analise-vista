import { describe, expect, it } from "vitest";
import {
  comentarioObservacao,
  exigeObservacao,
  lerObservacao,
  ultimasObservacoes,
} from "../observacaoTeste";

describe("observação do teste", () => {
  it("só ressalvas e reprovado exigem observação", () => {
    expect(exigeObservacao("aprovado_ressalvas")).toBe(true);
    expect(exigeObservacao("reprovado")).toBe(true);
    expect(exigeObservacao("aprovado")).toBe(false);
    expect(exigeObservacao("pre_build")).toBe(false);
  });

  it("grava e lê de volta, inclusive com quebra de linha", () => {
    const c = comentarioObservacao("reprovado", "  Botão salvar não grava.\nTestado no GED.  ");
    expect(c).toBe("Observação do teste (Reprovado): Botão salvar não grava.\nTestado no GED.");
    expect(lerObservacao(c)).toBe("Botão salvar não grava.\nTestado no GED.");
  });

  it("ignora comentários comuns e o registro do Fechar rodada", () => {
    expect(lerObservacao("Testei e está ok")).toBeNull();
    expect(lerObservacao("Observação do teste (enviada em 05/10/2026): x")).toBeNull();
  });

  it("fica com a mais recente de cada tarefa", () => {
    expect(
      ultimasObservacoes([
        {
          todo_id: "a",
          conteudo: comentarioObservacao("reprovado", "primeira"),
          created_at: "2026-10-10T10:00:00Z",
        },
        {
          todo_id: "a",
          conteudo: comentarioObservacao("aprovado_ressalvas", "segunda"),
          created_at: "2026-10-11T10:00:00Z",
        },
        { todo_id: "b", conteudo: "comentário comum", created_at: "2026-10-11T10:00:00Z" },
      ]),
    ).toEqual({ a: "segunda" });
  });
});
