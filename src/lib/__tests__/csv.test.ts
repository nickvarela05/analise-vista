import { describe, expect, it } from "vitest";
import { paraCsv } from "../csv";

describe("paraCsv", () => {
  it("cabeçalho, vazios e aspas onde precisa", () => {
    expect(
      paraCsv([
        { Código: 1, Unidade: "EMEF Brasil, Centro", Bairro: null },
        { Código: 2, Unidade: 'Escola "Nova"', Bairro: "Vila" },
      ]),
    ).toBe('Código,Unidade,Bairro\n1,"EMEF Brasil, Centro",\n2,"Escola ""Nova""",Vila');
  });
});
