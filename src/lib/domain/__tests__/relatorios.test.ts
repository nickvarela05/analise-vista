import { describe, expect, it } from "vitest";
import { isRelatorioPendente } from "../relatorios";

const r = (status: string | null, extra: Record<string, string> = {}) => ({
  id: "1",
  status,
  solicitante_nome: "Fulano",
  ...extra,
});

describe("isRelatorioPendente", () => {
  it("conta 'Pendente' e 'Pendente de análise' (status do n8n)", () => {
    expect(isRelatorioPendente(r("Pendente"), new Set())).toBe(true);
    expect(isRelatorioPendente(r("Pendente de análise"), new Set())).toBe(true);
  });

  it("não conta enviados, inativados nem os do Google", () => {
    expect(isRelatorioPendente(r("Enviado"), new Set())).toBe(false);
    expect(isRelatorioPendente(r("Pendente"), new Set(["1"]))).toBe(false);
    expect(isRelatorioPendente(r("Pendente", { solicitante_nome: "Google" }), new Set())).toBe(
      false,
    );
  });
});
