import { describe, expect, it } from "vitest";
import {
  formatarDias,
  mediana,
  qualidadePorSistema,
  ritmoSemanal,
  SEM_SISTEMA,
  temposDeEspera,
  type EventoStatus,
} from "../metricas";

const ev = (
  todo_id: string,
  de: string | null,
  para: string,
  em: string,
  extra: Partial<EventoStatus> = {},
): EventoStatus => ({
  todo_id,
  de,
  para,
  em,
  sistema: null,
  criadaEm: null,
  origem: null,
  ...extra,
});

describe("ritmoSemanal", () => {
  it("conta resultados de teste por semana e ignora outras mudanças", () => {
    const ref = new Date("2026-10-08T12:00:00");
    const r = ritmoSemanal(
      [
        ev("1", "homologacao", "aprovado", "2026-10-06T10:00:00"),
        ev("2", "homologacao", "reprovado", "2026-10-07T10:00:00"),
        ev("3", "homologacao", "aprovado_ressalvas", "2026-09-30T10:00:00"),
        ev("4", "aprovado", "pre_build", "2026-10-07T10:00:00"),
        ev("5", "homologacao", "aprovado", "2026-01-01T10:00:00"),
      ],
      2,
      ref,
    );
    expect(r).toEqual([
      { semana: "28/09", aprovado: 0, ressalvas: 1, reprovado: 0 },
      { semana: "05/10", aprovado: 1, ressalvas: 0, reprovado: 1 },
    ]);
  });
});

describe("mediana", () => {
  it("par, ímpar e vazio", () => {
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([4, 1, 2, 3])).toBe(2.5);
    expect(mediana([])).toBeNull();
  });
});

describe("temposDeEspera", () => {
  const desde = new Date("2026-09-01T00:00:00");

  it("usa a criação como início do teste de tarefa importada sem registro de entrada", () => {
    const r = temposDeEspera(
      [
        ev("1", "homologacao", "aprovado", "2026-10-04T12:00:00", {
          criadaEm: "2026-10-03T12:00:00",
          origem: "homologacao",
        }),
        ev("2", "em_andamento", "homologacao", "2026-10-01T00:00:00"),
        ev("2", "homologacao", "reprovado", "2026-10-04T00:00:00"),
        ev("2", "reprovado", "homologacao", "2026-10-05T00:00:00"),
        ev("2", "homologacao", "aprovado", "2026-10-05T12:00:00"),
      ],
      desde,
    );
    // Tarefa 1: 1 dia. Tarefa 2: 3 dias, depois 0,5 dia no reteste.
    expect(r.emTeste).toEqual({ medianaDias: 1, amostra: 3 });
  });

  it("mede Pré-build → Produção só com a entrada registrada", () => {
    const r = temposDeEspera(
      [
        ev("1", "aprovado", "pre_build", "2026-09-20T00:00:00"),
        ev("1", "pre_build", "producao", "2026-09-27T00:00:00"),
        ev("2", "pre_build", "producao", "2026-09-27T00:00:00"),
      ],
      desde,
    );
    expect(r.ateProducao).toEqual({ medianaDias: 7, amostra: 1 });
  });
});

describe("qualidadePorSistema", () => {
  it("conta a tarefa uma vez por sistema e deixa 'sem sistema' no fim", () => {
    const ref = new Date("2026-10-08T12:00:00");
    const r = qualidadePorSistema(
      [
        ev("1", "homologacao", "reprovado", "2026-10-04T10:00:00", { sistema: "GED" }),
        ev("1", "homologacao", "aprovado", "2026-10-05T10:00:00", { sistema: "GED" }),
        ev("2", "homologacao", "aprovado_ressalvas", "2026-10-05T10:00:00", { sistema: "GED" }),
        ev("3", "homologacao", "aprovado", "2026-10-05T10:00:00", { sistema: "BI" }),
        ev("4", "homologacao", "aprovado", "2026-09-05T10:00:00"),
        ev("5", "homologacao", "aprovado", "2026-01-05T10:00:00", { sistema: "BI" }),
      ],
      90,
      ref,
    );
    expect(r).toEqual([
      { sistema: "GED", testadas: 2, comRessalvas: 1, reprovadas: 1 },
      { sistema: "BI", testadas: 1, comRessalvas: 0, reprovadas: 0 },
      { sistema: SEM_SISTEMA, testadas: 1, comRessalvas: 0, reprovadas: 0 },
    ]);
  });
});

describe("formatarDias", () => {
  it("horas abaixo de um dia, singular e vírgula", () => {
    expect(formatarDias(null)).toBe("—");
    expect(formatarDias(0.3)).toBe("7 h");
    expect(formatarDias(1)).toBe("1 dia");
    expect(formatarDias(2.54)).toBe("2,5 dias");
    expect(formatarDias(7)).toBe("7 dias");
  });
});
