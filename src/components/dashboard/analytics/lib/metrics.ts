import {
  startOfWeek,
  addWeeks,
  format,
  differenceInDays,
  differenceInHours,
  startOfDay,
  addDays,
  isSameDay,
} from "date-fns";
import type { TarefaRow, DemandaRow, ReuniaoRow } from "@/lib/db-types";

const STATUS_CONCLUIDA = ["concluida", "producao"] as const;
const STATUS_ATIVAS = [
  "pendente",
  "aberta",
  "em_andamento",
  "encaminhada",
  "homologacao",
] as const;
const STATUS_WIP = ["em_andamento", "homologacao", "encaminhada"] as const;

export type WeekPoint = { semana: string; concluidas: number };

/** #1 Velocity: tarefas concluídas por semana (últimas N semanas) */
export function computeVelocity(tarefas: TarefaRow[], weeks = 8, ref = new Date()): WeekPoint[] {
  const start = startOfWeek(addWeeks(ref, -(weeks - 1)), { weekStartsOn: 1 });
  const buckets: WeekPoint[] = [];
  for (let i = 0; i < weeks; i++) {
    const ws = addWeeks(start, i);
    buckets.push({ semana: format(ws, "dd/MM"), concluidas: 0 });
  }
  for (const t of tarefas) {
    const ts = t.concluida_em ?? (STATUS_CONCLUIDA.includes(t.status as any) ? t.updated_at : null);
    if (!ts) continue;
    const d = new Date(ts);
    const idx = Math.floor(differenceInDays(d, start) / 7);
    if (idx >= 0 && idx < weeks) buckets[idx].concluidas++;
  }
  return buckets;
}

/** #2 Lead time (created→concluida) e cycle time aproximado (created→updated quando ativa em em_andamento) */
export function computeLeadCycle(tarefas: TarefaRow[]) {
  const lead: number[] = [];
  for (const t of tarefas) {
    if (!t.concluida_em || !t.created_at) continue;
    const d = differenceInHours(new Date(t.concluida_em), new Date(t.created_at)) / 24;
    if (d >= 0 && d < 365) lead.push(d);
  }
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const median = (a: number[]) => {
    if (!a.length) return 0;
    const s = [...a].sort((x, y) => x - y);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  return {
    leadAvg: avg(lead),
    leadMedian: median(lead),
    amostra: lead.length,
  };
}

/** #3 Throughput por colaborador (concluídas últimos N dias) */
export function computeThroughput(
  tarefas: TarefaRow[],
  colaboradores: { id: string; nome: string }[],
  days = 30,
  ref = new Date(),
) {
  const limit = addDays(ref, -days);
  const map = new Map<string, number>();
  for (const t of tarefas) {
    const ts = t.concluida_em ?? (STATUS_CONCLUIDA.includes(t.status as any) ? t.updated_at : null);
    if (!ts) continue;
    if (new Date(ts) < limit) continue;
    const ids = new Set<string>();
    if (t.responsavel_id) ids.add(t.responsavel_id);
    (t.responsaveis_ids ?? []).forEach((i) => i && ids.add(i));
    ids.forEach((id) => map.set(id, (map.get(id) ?? 0) + 1));
  }
  return colaboradores
    .map((c) => ({ nome: c.nome.split(" ")[0], total: map.get(c.id) ?? 0 }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total);
}

/** #4 Aging do backlog: tarefas ativas por bucket de idade */
export function computeAging(tarefas: TarefaRow[], ref = new Date()) {
  const buckets = [
    { faixa: "0-3 dias", min: 0, max: 3, total: 0, tone: "success" as const },
    { faixa: "4-7 dias", min: 4, max: 7, total: 0, tone: "info" as const },
    { faixa: "8-15 dias", min: 8, max: 15, total: 0, tone: "warning" as const },
    { faixa: "16-30 dias", min: 16, max: 30, total: 0, tone: "warning" as const },
    { faixa: "30+ dias", min: 31, max: Infinity, total: 0, tone: "destructive" as const },
  ];
  for (const t of tarefas) {
    if (!STATUS_ATIVAS.includes(t.status as any)) continue;
    if (!t.created_at) continue;
    const idade = differenceInDays(ref, new Date(t.created_at));
    const b = buckets.find((x) => idade >= x.min && idade <= x.max);
    if (b) b.total++;
  }
  return buckets;
}

/** #5 Heatmap próximos N dias: contagem por dia de prazos (tarefas+demandas) e reuniões agendadas */
export function computeHeatmap(
  tarefas: TarefaRow[],
  demandas: DemandaRow[],
  reunioes: ReuniaoRow[],
  days = 28,
  ref = new Date(),
) {
  const start = startOfDay(ref);
  const grid: { date: Date; count: number }[] = [];
  for (let i = 0; i < days; i++) grid.push({ date: addDays(start, i), count: 0 });
  const inc = (d: Date | null) => {
    if (!d) return;
    const cell = grid.find((g) => isSameDay(g.date, d));
    if (cell) cell.count++;
  };
  tarefas.forEach((t) => t.data_prevista && inc(new Date(t.data_prevista)));
  demandas.forEach((d) => d.prazo && inc(new Date(d.prazo)));
  reunioes.forEach((r) => r.status !== "cancelada" && inc(new Date(r.data_reuniao)));
  const max = Math.max(1, ...grid.map((g) => g.count));
  return { grid, max };
}

/** #6 WIP por colaborador */
export function computeWip(tarefas: TarefaRow[], colaboradores: { id: string; nome: string }[]) {
  const map = new Map<string, number>();
  for (const t of tarefas) {
    if (!STATUS_WIP.includes(t.status as any)) continue;
    const ids = new Set<string>();
    if (t.responsavel_id) ids.add(t.responsavel_id);
    (t.responsaveis_ids ?? []).forEach((i) => i && ids.add(i));
    ids.forEach((id) => map.set(id, (map.get(id) ?? 0) + 1));
  }
  return colaboradores
    .map((c) => ({ nome: c.nome.split(" ")[0], wip: map.get(c.id) ?? 0 }))
    .filter((x) => x.wip > 0)
    .sort((a, b) => b.wip - a.wip);
}

/** #7 Taxa de reprovação em homologação (últimos 60 dias) */
export function computeTaxaReprovacao(tarefas: TarefaRow[], days = 60, ref = new Date()) {
  const limit = addDays(ref, -days);
  let aprov = 0, reprov = 0;
  for (const t of tarefas) {
    if (!t.updated_at || new Date(t.updated_at) < limit) continue;
    if (t.status === "reprovada") reprov++;
    else if (t.status === "aprovado" || t.status === "aprovado_ressalvas" || t.status === "producao" || t.status === "concluida") aprov++;
  }
  const total = aprov + reprov;
  return { aprov, reprov, total, taxa: total ? (reprov / total) * 100 : 0 };
}

/** #8 Tempo médio "em" cada status (aproximação updated_at-created_at por status atual) */
export function computeTempoPorEtapa(tarefas: TarefaRow[]) {
  const groups: Record<string, number[]> = {};
  for (const t of tarefas) {
    if (!t.created_at || !t.updated_at) continue;
    const d = differenceInHours(new Date(t.updated_at), new Date(t.created_at)) / 24;
    if (d < 0 || d > 365) continue;
    const k = t.status as string;
    (groups[k] ??= []).push(d);
  }
  const labels: Record<string, string> = {
    pendente: "A fazer",
    aberta: "A fazer",
    em_andamento: "Desenvolvimento",
    encaminhada: "Em homologação",
    homologacao: "Em homologação",
    aprovado: "Aprovada",
    aprovado_ressalvas: "Com ajustes",
    reprovada: "Com ajustes",
    producao: "Em produção",
    concluida: "Concluída",
  };
  const merged: Record<string, number[]> = {};
  for (const [k, arr] of Object.entries(groups)) {
    const lbl = labels[k] ?? k;
    (merged[lbl] ??= []).push(...arr);
  }
  return Object.entries(merged)
    .map(([etapa, arr]) => ({
      etapa,
      dias: +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1),
      n: arr.length,
    }))
    .sort((a, b) => b.dias - a.dias);
}

/** #9 Distribuição por categoria + origem das demandas */
export function computeCategoriaOrigem(demandas: DemandaRow[]) {
  const cat = new Map<string, number>();
  const orig = new Map<string, number>();
  const labelsCat: Record<string, string> = {
    bug: "Bug",
    melhoria: "Melhoria",
    nova_funcionalidade: "Nova funcionalidade",
    duvida: "Dúvida",
    documentacao: "Documentação",
    outro: "Outro",
  };
  const labelsOrig: Record<string, string> = {
    email: "E-mail",
    reuniao: "Reunião",
    chamado: "Chamado",
    whatsapp: "WhatsApp",
    outro: "Outro",
  };
  for (const d of demandas) {
    cat.set(labelsCat[d.categoria] ?? d.categoria, (cat.get(labelsCat[d.categoria] ?? d.categoria) ?? 0) + 1);
    orig.set(labelsOrig[d.origem] ?? d.origem, (orig.get(labelsOrig[d.origem] ?? d.origem) ?? 0) + 1);
  }
  const toArr = (m: Map<string, number>) =>
    Array.from(m.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  return { categorias: toArr(cat), origens: toArr(orig) };
}

type Solic = {
  status: string | null;
  urgencia: string | null;
  criado_em: string | null;
  prazo: string | null;
  solicitante_nome: string | null;
  categoria: string | null;
};

const isPend = (s: string | null) => (s ?? "").toLowerCase() === "pendente";
const isFeito = (s: string | null) => (s ?? "").toLowerCase() === "feito";
const isEnv = (s: string | null) => (s ?? "").toLowerCase() === "enviado";

/** #10 Funil Pendente → Feito → Enviado */
export function computeFunilRelatorios(rows: Solic[]) {
  let p = 0, f = 0, e = 0;
  for (const r of rows) {
    if (isPend(r.status)) p++;
    else if (isFeito(r.status)) f++;
    else if (isEnv(r.status)) e++;
  }
  const tot = p + f + e || 1;
  return [
    { etapa: "Pendente", total: p, pct: Math.round((p / tot) * 100) },
    { etapa: "Feito", total: f, pct: Math.round((f / tot) * 100) },
    { etapa: "Enviado", total: e, pct: Math.round((e / tot) * 100) },
  ];
}

/** #11 SLA por urgência: idade média (dias) das pendentes por urgência + total */
export function computeSlaUrgencia(rows: Solic[], ref = new Date()) {
  const groups: Record<string, { idade: number[]; total: number }> = {};
  for (const r of rows) {
    if (!isPend(r.status)) continue;
    const u = (r.urgencia ?? "Não definida").trim() || "Não definida";
    (groups[u] ??= { idade: [], total: 0 });
    groups[u].total++;
    if (r.criado_em) {
      const dias = differenceInHours(ref, new Date(r.criado_em)) / 24;
      if (dias >= 0) groups[u].idade.push(dias);
    }
  }
  return Object.entries(groups)
    .map(([urgencia, g]) => ({
      urgencia,
      pendentes: g.total,
      idadeMedia: g.idade.length ? +(g.idade.reduce((a, b) => a + b, 0) / g.idade.length).toFixed(1) : 0,
    }))
    .sort((a, b) => b.pendentes - a.pendentes);
}

/** #12 Top solicitantes nos últimos N dias */
export function computeTopSolicitantes(rows: Solic[], days = 90, top = 8, ref = new Date()) {
  const limit = addDays(ref, -days);
  const map = new Map<string, number>();
  for (const r of rows) {
    if (!r.criado_em) continue;
    if (new Date(r.criado_em) < limit) continue;
    const nome = (r.solicitante_nome ?? "").trim();
    if (!nome) continue;
    map.set(nome, (map.get(nome) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, top);
}
