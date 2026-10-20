import { describe, expect, it } from "vitest";
import {
  entradasPreBuild,
  filaPreBuild,
  liberadasPorSemana,
  quemLibera,
  type EventoStatus,
} from "../metricas";

const ev = (todo_id: string, para: string, em: string): EventoStatus => ({
  todo_id,
  de: null,
  para,
  em,
  sistema: null,
  criadaEm: null,
  origem: null,
});

const ref = new Date("2026-10-20T12:00:00Z");

describe("entradasPreBuild", () => {
  it("guarda a última entrada em Pré-build de cada tarefa", () => {
    const m = entradasPreBuild([
      ev("a", "pre_build", "2026-10-09T10:00:00Z"),
      ev("a", "homologacao", "2026-10-10T10:00:00Z"),
      ev("a", "pre_build", "2026-10-15T10:00:00Z"),
      ev("b", "producao", "2026-10-15T10:00:00Z"),
    ]);
    expect(m).toEqual({ a: "2026-10-15T10:00:00Z" });
  });
});

describe("filaPreBuild", () => {
  it("separa por idade e não inventa idade para quem não tem data de entrada", () => {
    const tarefas = [
      { id: "nova", status: "pre_build" },
      { id: "media", status: "pre_build" },
      { id: "velha", status: "pre_build" },
      { id: "sem", status: "pre_build" },
      { id: "fora", status: "producao" },
    ];
    const entradas = {
      nova: "2026-10-18T12:00:00Z",
      media: "2026-10-10T12:00:00Z",
      velha: "2026-10-01T12:00:00Z",
      fora: "2026-09-01T12:00:00Z",
    };
    expect(filaPreBuild(tarefas, entradas, ref)).toEqual({
      total: 4,
      faixas: { ate7: 1, de8a14: 1, mais14: 1, semData: 1 },
    });
  });
});

describe("liberadasPorSemana", () => {
  it("conta entradas em Produção por semana, só nas últimas semanas", () => {
    const r = liberadasPorSemana(
      [
        ev("a", "producao", "2026-10-19T10:00:00Z"),
        ev("b", "producao", "2026-10-20T10:00:00Z"),
        ev("c", "producao", "2026-10-13T10:00:00Z"),
        ev("d", "pre_build", "2026-10-13T10:00:00Z"),
        ev("e", "producao", "2026-01-05T10:00:00Z"),
      ],
      2,
      ref,
    );
    expect(r).toEqual([
      { semana: "12/10", liberadas: 1 },
      { semana: "19/10", liberadas: 2 },
    ]);
  });
});

describe("quemLibera", () => {
  it("conta validações desde a data, de quem mais liberou para quem menos", () => {
    const r = quemLibera(
      [
        { liberacao_validada_por: "Felipe", liberacao_validada_em: "2026-10-15T10:00:00Z" },
        { liberacao_validada_por: "Felipe", liberacao_validada_em: "2026-10-16T10:00:00Z" },
        { liberacao_validada_por: "Hugo", liberacao_validada_em: "2026-10-19T10:00:00Z" },
        { liberacao_validada_por: "Hugo", liberacao_validada_em: "2026-08-01T10:00:00Z" },
        { liberacao_validada_por: null, liberacao_validada_em: null },
      ],
      new Date("2026-10-01T00:00:00Z"),
    );
    expect(r).toEqual([
      { nome: "Felipe", liberadas: 2 },
      { nome: "Hugo", liberadas: 1 },
    ]);
  });
});
