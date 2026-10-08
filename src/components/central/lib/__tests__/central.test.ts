import { describe, expect, it } from "vitest";
import type { TarefaRow } from "@/lib/db-types";
import { aguardandoProducao, filaPorPessoa, resumirRodada } from "../central";

const t = (id: string, status: string, extra: Record<string, unknown> = {}) =>
  ({
    id,
    status,
    lote_importacao_id: null,
    responsavel_id: null,
    responsaveis_ids: [],
    equipe_toda: false,
    ...extra,
  }) as unknown as TarefaRow;

describe("resumirRodada", () => {
  it("conta só as tarefas da rodada e agrupa por lote, do mais recente ao mais antigo", () => {
    const lotes = [
      { id: "L1", nome: "HML – 26/09", created_at: "2026-09-26T10:00:00Z" },
      { id: "L2", nome: "HML – 03/10", created_at: "2026-10-03T10:00:00Z" },
    ];
    const r = resumirRodada(
      [
        t("1", "homologacao", { lote_importacao_id: "L2" }),
        t("2", "aprovado", { lote_importacao_id: "L2" }),
        t("3", "aprovado_ressalvas", { lote_importacao_id: "L1" }),
        t("4", "reprovado", { lote_importacao_id: "L2" }),
        t("5", "pre_build", { lote_importacao_id: "L1" }),
        t("6", "em_andamento"),
      ],
      lotes,
    );
    expect(r).toMatchObject({
      total: 4,
      aTestar: 1,
      aprovadas: 1,
      ressalvas: 1,
      reprovadas: 1,
      pct: 75,
    });
    expect(r.lotes.map((l) => [l.nome, l.total, l.aTestar])).toEqual([
      ["HML – 03/10", 3, 1],
      ["HML – 26/09", 1, 0],
    ]);
  });

  it("rodada vazia não divide por zero", () => {
    expect(resumirRodada([t("1", "producao")], [])).toMatchObject({ total: 0, pct: 0, lotes: [] });
  });
});

describe("filaPorPessoa", () => {
  const colabs = [
    { id: "a", nome: "Ana" },
    { id: "b", nome: "Bruno" },
  ];

  it("conta tarefa com dois responsáveis para os dois e põe 'Sem responsável' no topo", () => {
    const fila = filaPorPessoa(
      [
        t("1", "homologacao", { responsaveis_ids: ["a", "b"] }),
        t("2", "homologacao", { responsaveis_ids: ["b"] }),
        t("3", "reprovado", { responsaveis_ids: ["a"] }),
        t("4", "homologacao"),
        t("5", "aprovado", { responsavel_id: "a" }),
        t("6", "producao", { responsaveis_ids: ["a"] }),
      ],
      colabs,
    );
    expect(fila.map((p) => [p.nome, p.aTestar, p.testadas, p.reprovadas])).toEqual([
      ["Sem responsável", 1, 0, 0],
      ["Bruno", 2, 0, 0],
      ["Ana", 1, 2, 1],
    ]);
  });

  it("tarefa da equipe toda vira uma linha própria", () => {
    const fila = filaPorPessoa(
      [t("1", "homologacao", { equipe_toda: true, responsaveis_ids: ["a"] })],
      colabs,
    );
    expect(fila.map((p) => p.nome)).toEqual(["Equipe toda"]);
  });
});

describe("aguardandoProducao", () => {
  it("ordena pela espera e deixa sem registro no fim, sem inventar dias", () => {
    const hoje = new Date("2026-10-08T12:00:00");
    const lista = aguardandoProducao(
      [t("1", "pre_build"), t("2", "pre_build"), t("3", "pre_build"), t("4", "aprovado")],
      { "1": "2026-10-06T09:00:00", "3": "2026-09-30T09:00:00", "4": "2026-09-01T09:00:00" },
      hoje,
    );
    expect(lista.map((a) => [a.tarefa.id, a.dias])).toEqual([
      ["3", 8],
      ["1", 2],
      ["2", null],
    ]);
  });
});
