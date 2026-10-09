import { describe, expect, it } from "vitest";
import { agruparPorPessoa, distribuirIguais, distribuirPorSistema } from "../distribuir";

const t = (id: string, sistema: string | null, titulo = `Tarefa ${id}`) => ({
  id,
  sistema,
  titulo,
});

describe("distribuirIguais", () => {
  it("blocos seguidos por sistema, diferença máxima de 1", () => {
    const r = distribuirIguais(
      [t("9", "MAED"), t("1", "GED"), t("2", "GED"), t("5", "BI"), t("3", "GED")],
      ["ana", "bruno"],
    );
    // Ordem: BI 5 · GED 1, 2, 3 · MAED 9 → ana fica com 3, bruno com 2.
    expect(r).toEqual({ "5": "ana", "1": "ana", "2": "ana", "3": "bruno", "9": "bruno" });
  });

  it("ordena o número da tarefa como número (9069 antes de 10001)", () => {
    const r = distribuirIguais(
      [t("b", "GED", "Tarefa 10001"), t("a", "GED", "Tarefa 9069")],
      ["x", "y"],
    );
    expect(r).toEqual({ a: "x", b: "y" });
  });

  it("sem pessoas não atribui nada", () => {
    expect(distribuirIguais([t("1", "GED")], [])).toEqual({});
  });
});

describe("distribuirPorSistema", () => {
  it("sistema sem pessoa escolhida fica de fora; sem sistema usa a chave vazia", () => {
    const r = distribuirPorSistema([t("1", "GED"), t("2", "BI"), t("3", null)], {
      GED: "ana",
      "": "bruno",
    });
    expect(r).toEqual({ "1": "ana", "3": "bruno" });
  });
});

describe("agruparPorPessoa", () => {
  it("um grupo por pessoa", () => {
    expect(agruparPorPessoa({ "1": "ana", "2": "bruno", "3": "ana" })).toEqual({
      ana: ["1", "3"],
      bruno: ["2"],
    });
  });
});
