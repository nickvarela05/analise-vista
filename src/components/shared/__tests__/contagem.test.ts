import { describe, expect, it } from "vitest";
import { separar } from "../separarNumero";

describe("separar (Contagem)", () => {
  it("número inteiro e decimal", () => {
    expect(separar(29)).toEqual({ alvo: 29, casas: 0, virgula: false, resto: "" });
    expect(separar(2.5)).toEqual({ alvo: 2.5, casas: 1, virgula: false, resto: "" });
  });
  it("texto que começa com número mantém o resto e a vírgula", () => {
    expect(separar("2,5 dias")).toEqual({ alvo: 2.5, casas: 1, virgula: true, resto: " dias" });
    expect(separar("18 h")).toEqual({ alvo: 18, casas: 0, virgula: false, resto: " h" });
  });
  it("texto sem número não anima", () => {
    expect(separar("—")).toBeNull();
    expect(separar(Number.NaN)).toBeNull();
  });
});
