import { describe, expect, it } from "vitest";
import { padronizarTitulo } from "../taskNumber";

describe("padronizarTitulo", () => {
  it("põe no padrão 'Tarefa N - título'", () => {
    expect(padronizarTitulo("9104 - Criar tela")).toBe("Tarefa 9104 - Criar tela");
    expect(padronizarTitulo("9322 - \t Ajustar login")).toBe("Tarefa 9322 - Ajustar login");
    expect(padronizarTitulo("tarefa: 9092 Criar objeto")).toBe("Tarefa 9092 - Criar objeto");
    expect(padronizarTitulo("Tarefa 9092 - Criar objeto")).toBe("Tarefa 9092 - Criar objeto");
    expect(padronizarTitulo("Tarefa 9092")).toBe("Tarefa 9092");
  });
  it("não mexe em título sem número", () => {
    expect(padronizarTitulo("  Revisar   layout ")).toBe("Revisar layout");
    expect(padronizarTitulo("Reunião de 2026 com o time")).toBe("Reunião de 2026 com o time");
  });
});
