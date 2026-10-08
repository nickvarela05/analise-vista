import { describe, expect, it } from "vitest";
import { etapasLiberacao, faltaLiberacao } from "../liberacao";

describe("liberação em produção", () => {
  it("nada confirmado: faltam as três, na ordem", () => {
    expect(faltaLiberacao({})).toEqual(["versão", "acesso", "validação"]);
  });

  it("acesso dispensado conta como feito e muda o rótulo", () => {
    const t = {
      liberacao_versao_em: "2026-10-09T10:00:00Z",
      liberacao_acesso_em: "2026-10-09T11:00:00Z",
      liberacao_acesso_dispensada: true,
    };
    expect(faltaLiberacao(t)).toEqual(["validação"]);
    expect(etapasLiberacao(t)[1]).toMatchObject({
      rotulo: "Acessos: não precisa liberar",
      feita: true,
    });
  });
});
