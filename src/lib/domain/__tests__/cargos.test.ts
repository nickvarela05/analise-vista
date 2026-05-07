import { describe, it, expect } from "vitest";
import { cargoElegivel } from "../cargos";

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
  });

  it("trata null/undefined/string vazia como falso", () => {
    expect(cargoElegivel(null)).toBe(false);
    expect(cargoElegivel(undefined)).toBe(false);
    expect(cargoElegivel("")).toBe(false);
  });
});
