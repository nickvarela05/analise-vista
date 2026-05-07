import { describe, it, expect } from "vitest";
import {
  isAtribuidoA,
  contarAtribuicoes,
  filtrarPorEscopo,
} from "../atividades";

describe("isAtribuidoA", () => {
  it("equipe_toda sempre verdadeiro", () => {
    expect(isAtribuidoA({ equipe_toda: true }, "qualquer")).toBe(true);
    expect(isAtribuidoA({ equipe_toda: true }, null)).toBe(true);
  });

  it("colabId nulo + sem equipe_toda → falso", () => {
    expect(isAtribuidoA({ responsaveis_ids: ["x"] }, null)).toBe(false);
  });

  it("usa responsaveis_ids quando presente", () => {
    expect(isAtribuidoA({ responsaveis_ids: ["a", "b"] }, "b")).toBe(true);
    expect(isAtribuidoA({ responsaveis_ids: ["a", "b"] }, "c")).toBe(false);
  });

  it("fallback para responsavel_id legado quando responsaveis_ids vazio", () => {
    expect(isAtribuidoA({ responsaveis_ids: [], responsavel_id: "a" }, "a")).toBe(true);
    expect(isAtribuidoA({ responsavel_id: "a" }, "a")).toBe(true);
    expect(isAtribuidoA({ responsavel_id: "a" }, "b")).toBe(false);
  });
});

describe("contarAtribuicoes", () => {
  it("conta corretamente diferentes tipos de atribuição", () => {
    const rows = [
      { equipe_toda: true },
      { responsaveis_ids: ["a"] },
      { responsaveis_ids: ["b"] },
      { responsavel_id: "a" },
    ];
    expect(contarAtribuicoes(rows, "a")).toBe(3);
    expect(contarAtribuicoes(rows, "b")).toBe(2);
    expect(contarAtribuicoes(rows, "c")).toBe(1);
  });
});

describe("filtrarPorEscopo", () => {
  const rows = [
    { id: 1, equipe_toda: true },
    { id: 2, responsaveis_ids: ["a"] },
    { id: 3, responsaveis_ids: ["b"] },
  ];

  it("escopo equipe retorna tudo", () => {
    expect(filtrarPorEscopo(rows, "equipe", "a")).toHaveLength(3);
  });

  it("escopo minhas filtra pelo colaborador", () => {
    expect(filtrarPorEscopo(rows, "minhas", "a").map((r) => r.id)).toEqual([1, 2]);
  });

  it("escopo minhas com colabId nulo retorna vazio", () => {
    expect(filtrarPorEscopo(rows, "minhas", null)).toEqual([]);
  });
});
