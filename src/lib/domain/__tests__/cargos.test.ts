import { describe, it, expect } from "vitest";
import { cargoElegivel, opcoesResponsavel, podeReceberTarefa } from "../cargos";

describe("cargoElegivel", () => {
  it("aceita analistas e gestores", () => {
    expect(cargoElegivel("Analista de Requisitos Júnior")).toBe(true);
    expect(cargoElegivel("Coordenador de Requisitos (Gestor)")).toBe(true);
  });

  it("aceita Estagiário TI mas rejeita Estagiário comum", () => {
    expect(cargoElegivel("Estagiário TI")).toBe(true);
    expect(cargoElegivel("Estagiário")).toBe(false);
  });

  it("rejeita cargos não atribuíveis", () => {
    expect(cargoElegivel("Help-Desk")).toBe(false);
    expect(cargoElegivel("Técnico de Suporte de TI")).toBe(false);
    expect(cargoElegivel("Gerente")).toBe(false);
  });

  it("trata null/undefined/string vazia como falso", () => {
    expect(cargoElegivel(null)).toBe(false);
    expect(cargoElegivel(undefined)).toBe(false);
    expect(cargoElegivel("")).toBe(false);
  });
});

describe("podeReceberTarefa", () => {
  it("só analistas de requisitos (decisão de 13/10/2026)", () => {
    expect(podeReceberTarefa("Analista de Requisitos Sênior")).toBe(true);
    expect(podeReceberTarefa("Analista de Requisitos Pleno")).toBe(true);
    expect(podeReceberTarefa("Coordenador de Requisitos (Gestor)")).toBe(false);
    expect(podeReceberTarefa("Estagiário TI")).toBe(false);
    expect(podeReceberTarefa("Gerente")).toBe(false);
    expect(podeReceberTarefa("Help-Desk")).toBe(false);
  });

  it("mantém nas opções quem já está atribuído, mesmo sem ser analista", () => {
    const colabs = [
      { id: "a", cargo: "Analista de Requisitos Pleno" },
      { id: "g", cargo: "Coordenador de Requisitos (Gestor)" },
      { id: "h", cargo: "Help-Desk" },
    ];
    expect(opcoesResponsavel(colabs).map((c) => c.id)).toEqual(["a"]);
    expect(opcoesResponsavel(colabs, ["g"]).map((c) => c.id)).toEqual(["a", "g"]);
  });
});
