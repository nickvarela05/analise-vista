import { describe, expect, it } from "vitest";
import { paraAgenda } from "../agenda-pessoal.server";

const EU = "colab-eu";
const reuniao = (extra: Record<string, unknown>) => ({
  id: "r",
  titulo: "Alinhamento",
  data_reuniao: "2026-10-28T13:00:00+00:00",
  duracao_min: 30,
  status: "agendada",
  equipe_toda: false,
  responsavel_id: null,
  responsaveis_ids: [],
  pauta: "não pode sair", // coluna a mais nunca vai na resposta
  ...extra,
});

describe("agenda pessoal para o MemorIA", () => {
  it("só reuniões do colaborador (responsável, lista ou equipe toda), sem as canceladas, só com o mínimo", () => {
    const r = paraAgenda(
      [
        reuniao({ id: "1", responsavel_id: EU }),
        reuniao({ id: "2", responsaveis_ids: ["outro", EU] }),
        reuniao({ id: "3", equipe_toda: true }),
        reuniao({ id: "4", responsaveis_ids: ["outro"] }),
        reuniao({ id: "5", responsavel_id: EU, status: "cancelada" }),
      ],
      [],
      EU,
    );
    expect(r.reunioes.map((x) => x.id)).toEqual(["1", "2", "3"]);
    expect(Object.keys(r.reunioes[0]!).sort()).toEqual([
      "duracaoMin",
      "id",
      "inicio",
      "status",
      "titulo",
    ]);
  });

  it("processos: do colaborador ou da equipe toda, sem os concluídos", () => {
    const p = (extra: Record<string, unknown>) => ({
      id: "p",
      nome: "Censo",
      previsto_inicio: "2026-11-01",
      previsto_fim: "2026-11-30",
      status: "planejado",
      equipe_toda: false,
      responsaveis_ids: [],
      ...extra,
    });
    const r = paraAgenda(
      [],
      [
        p({ id: "1", responsaveis_ids: [EU] }),
        p({ id: "2", equipe_toda: true }),
        p({ id: "3", responsaveis_ids: [EU], status: "concluido" }),
        p({ id: "4" }),
      ],
      EU,
    );
    expect(r.processos).toEqual([
      { id: "1", nome: "Censo", inicio: "2026-11-01", fim: "2026-11-30", status: "planejado" },
      { id: "2", nome: "Censo", inicio: "2026-11-01", fim: "2026-11-30", status: "planejado" },
    ]);
  });
});
