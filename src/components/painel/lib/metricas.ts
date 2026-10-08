// Indicadores do Painel da gestão (08/10/2026). Saem do histórico de status (`todo_historico`),
// não do status atual, porque perguntam "quanto tempo levou" e "quantas por semana".
//
// Limite conhecido do histórico: até 08/10/2026 a entrada em Homologação de tarefas importadas e
// as mudanças de status em lote não eram gravadas. Por isso:
//  - o início do teste de uma tarefa importada sem registro de entrada é a criação dela
//    (a importação já a cria em Homologação);
//  - a espera em Pré-build só é medida quando há registro da entrada; os indicadores mostram o
//    tamanho da amostra para não parecer mais certo do que é.
import { addWeeks, differenceInCalendarWeeks, format, startOfWeek, subDays } from "date-fns";

export type EventoStatus = {
  todo_id: string;
  de: string | null;
  para: string | null;
  em: string;
  sistema: string | null;
  criadaEm: string | null;
  origem: string | null;
};

const VEREDITOS = new Set(["aprovado", "aprovado_ressalvas", "reprovado"]);
const DIA = 86_400_000;

export type SemanaRitmo = {
  semana: string;
  aprovado: number;
  ressalvas: number;
  reprovado: number;
};

/** Resultados de teste por semana (segunda a domingo), das últimas `semanas`. */
export function ritmoSemanal(
  eventos: readonly EventoStatus[],
  semanas = 8,
  ref = new Date(),
): SemanaRitmo[] {
  const inicio = startOfWeek(addWeeks(ref, -(semanas - 1)), { weekStartsOn: 1 });
  const out: SemanaRitmo[] = Array.from({ length: semanas }, (_, i) => ({
    semana: format(addWeeks(inicio, i), "dd/MM"),
    aprovado: 0,
    ressalvas: 0,
    reprovado: 0,
  }));
  for (const e of eventos) {
    if (!e.para || !VEREDITOS.has(e.para)) continue;
    const i = differenceInCalendarWeeks(new Date(e.em), inicio, { weekStartsOn: 1 });
    if (i < 0 || i >= semanas) continue;
    if (e.para === "aprovado") out[i].aprovado++;
    else if (e.para === "aprovado_ressalvas") out[i].ressalvas++;
    else out[i].reprovado++;
  }
  return out;
}

export function mediana(valores: readonly number[]): number | null {
  if (valores.length === 0) return null;
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function porTarefa(eventos: readonly EventoStatus[]) {
  const m = new Map<string, EventoStatus[]>();
  for (const e of eventos) {
    const l = m.get(e.todo_id);
    if (l) l.push(e);
    else m.set(e.todo_id, [e]);
  }
  for (const l of m.values()) l.sort((a, b) => a.em.localeCompare(b.em));
  return m;
}

export type Espera = { medianaDias: number | null; amostra: number };

/**
 * Onde a tarefa espera: da entrada em Homologação ao primeiro resultado de teste, e da entrada
 * em Pré-build à Produção. Mediana em dias (com fração), para não ser puxada por casos extremos.
 */
export function temposDeEspera(
  eventos: readonly EventoStatus[],
  desde: Date,
): { emTeste: Espera; ateProducao: Espera } {
  const teste: number[] = [];
  const producao: number[] = [];
  for (const lista of porTarefa(eventos).values()) {
    let entradaTeste: number | null = null;
    let entradaPreBuild: number | null = null;
    // Tarefa importada nasce em Homologação: a criação é o início do teste.
    const primeira = lista[0];
    if (primeira?.criadaEm && primeira.origem === "homologacao" && primeira.de === "homologacao") {
      entradaTeste = new Date(primeira.criadaEm).getTime();
    }
    for (const e of lista) {
      const t = new Date(e.em).getTime();
      const conta = t >= desde.getTime();
      if (e.para === "homologacao") entradaTeste = t;
      else if (e.de === "homologacao" && e.para && VEREDITOS.has(e.para) && entradaTeste !== null) {
        if (conta) teste.push((t - entradaTeste) / DIA);
        entradaTeste = null;
      }
      if (e.para === "pre_build") entradaPreBuild = t;
      else if (e.para === "producao" && entradaPreBuild !== null) {
        if (conta) producao.push((t - entradaPreBuild) / DIA);
        entradaPreBuild = null;
      }
    }
  }
  return {
    emTeste: { medianaDias: mediana(teste), amostra: teste.length },
    ateProducao: { medianaDias: mediana(producao), amostra: producao.length },
  };
}

export type QualidadeSistema = {
  sistema: string;
  testadas: number;
  comRessalvas: number;
  reprovadas: number;
};

export const SEM_SISTEMA = "Sem sistema informado";

/**
 * Por sistema, nos últimos `dias`: quantas tarefas foram testadas e quantas tiveram ressalva ou
 * reprovação ao menos uma vez. O sistema só é gravado desde 03/10/2026 (receber pacote pelo
 * e-mail); as anteriores caem em "Sem sistema informado", sempre no fim da lista.
 */
export function qualidadePorSistema(
  eventos: readonly EventoStatus[],
  dias = 90,
  ref = new Date(),
): QualidadeSistema[] {
  const desde = subDays(ref, dias).toISOString();
  const tarefas = new Map<string, { sistema: string; ressalva: boolean; reprovada: boolean }>();
  for (const e of eventos) {
    if (e.em < desde || !e.para || !VEREDITOS.has(e.para)) continue;
    let t = tarefas.get(e.todo_id);
    if (!t)
      tarefas.set(
        e.todo_id,
        (t = { sistema: e.sistema?.trim() || SEM_SISTEMA, ressalva: false, reprovada: false }),
      );
    if (e.para === "aprovado_ressalvas") t.ressalva = true;
    if (e.para === "reprovado") t.reprovada = true;
  }
  const grupos = new Map<string, QualidadeSistema>();
  for (const t of tarefas.values()) {
    let g = grupos.get(t.sistema);
    if (!g)
      grupos.set(
        t.sistema,
        (g = { sistema: t.sistema, testadas: 0, comRessalvas: 0, reprovadas: 0 }),
      );
    g.testadas++;
    if (t.ressalva) g.comRessalvas++;
    if (t.reprovada) g.reprovadas++;
  }
  return [...grupos.values()].sort((a, b) => {
    if (a.sistema === SEM_SISTEMA) return 1;
    if (b.sistema === SEM_SISTEMA) return -1;
    return b.testadas - a.testadas || a.sistema.localeCompare(b.sistema);
  });
}

/** Duração legível: "18 h" abaixo de um dia, "1 dia", "2,5 dias". */
export function formatarDias(d: number | null): string {
  if (d === null) return "—";
  if (d < 1) return `${Math.max(1, Math.round(d * 24))} h`;
  const n = d.toFixed(1).replace(/\.0$/, "").replace(".", ",");
  return `${n} dia${n === "1" ? "" : "s"}`;
}
