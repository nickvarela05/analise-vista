import { describe, expect, it } from "vitest";
import { mensagemSenha, problemasSenha } from "../senha";

describe("regra de senha", () => {
  it("aceita 8+ com minúscula, maiúscula e número", () => {
    expect(problemasSenha("Nexus2026")).toEqual([]);
    expect(mensagemSenha("Abcdefg1")).toBeNull();
  });

  it("aponta o que falta, em português", () => {
    expect(mensagemSenha("abc")).toBe(
      "A senha precisa de pelo menos 8 caracteres, uma letra maiúscula e um número.",
    );
    expect(mensagemSenha("abcdefgh1")).toBe("A senha precisa de uma letra maiúscula.");
  });
});
