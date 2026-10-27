// ---------- Types ----------

export type ProcessoStatus = "planejado" | "em_andamento" | "concluido" | "atrasado";
export type CorProcesso =
  | "indigo"
  | "sky"
  | "emerald"
  | "violet"
  | "amber"
  | "rose"
  | "cyan"
  | "primary";

export type Processo = {
  id: string;
  ano: number;
  nome: string;
  descricao: string | null;
  cor: CorProcesso;
  previsto_inicio: string | null;
  previsto_fim: string | null;
  real_inicio: string | null;
  real_fim: string | null;
  responsaveis_ids: string[];
  equipe_toda: boolean;
  status: ProcessoStatus;
  alerta_dias_antes: number;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export type ProcessoVinculo = {
  id: string;
  processo_id: string;
  tipo: "tarefa" | "demanda";
  ref_id: string;
};

// ---------- Constants ----------

export const STATUS_LABEL: Record<ProcessoStatus, string> = {
  planejado: "Planejado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  atrasado: "Atrasado",
};

export const STATUS_TONE: Record<ProcessoStatus, { bg: string; text: string; ring: string }> = {
  planejado: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    ring: "ring-border",
  },
  em_andamento: {
    bg: "bg-sky-500/15",
    text: "text-sky-600 dark:text-sky-400",
    ring: "ring-sky-500/30",
  },
  concluido: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/30",
  },
  atrasado: {
    bg: "bg-rose-500/15",
    text: "text-rose-600 dark:text-rose-400",
    ring: "ring-rose-500/30",
  },
};

export const COR_OPTIONS: { value: CorProcesso; label: string; swatch: string }[] = [
  { value: "indigo", label: "Índigo", swatch: "bg-indigo-500" },
  { value: "sky", label: "Azul", swatch: "bg-sky-500" },
  { value: "emerald", label: "Verde", swatch: "bg-emerald-500" },
  { value: "violet", label: "Violeta", swatch: "bg-violet-500" },
  { value: "amber", label: "Âmbar", swatch: "bg-amber-500" },
  { value: "rose", label: "Rosa", swatch: "bg-rose-500" },
  { value: "cyan", label: "Ciano", swatch: "bg-cyan-500" },
  { value: "primary", label: "Primário", swatch: "bg-primary" },
];

export const COR_BG: Record<CorProcesso, string> = {
  indigo: "bg-indigo-500",
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  cyan: "bg-cyan-500",
  primary: "bg-primary",
};

export const COR_BG_SOFT: Record<CorProcesso, string> = {
  indigo: "bg-indigo-500/25 border-indigo-500/60",
  sky: "bg-sky-500/25 border-sky-500/60",
  emerald: "bg-emerald-500/25 border-emerald-500/60",
  violet: "bg-violet-500/25 border-violet-500/60",
  amber: "bg-amber-500/25 border-amber-500/60",
  rose: "bg-rose-500/25 border-rose-500/60",
  cyan: "bg-cyan-500/25 border-cyan-500/60",
  primary: "bg-primary/25 border-primary/60",
};

// ---------- Helpers ----------

export const HOJE = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export function parseISODate(s: string | null): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function fmtBR(s: string | null): string {
  const d = parseISODate(s);
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export function fmtBRData(s: string | null): string {
  const d = parseISODate(s);
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
  });
}

export function diasEntre(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function duracaoDias(inicio: string | null, fim: string | null): number | null {
  const a = parseISODate(inicio);
  const b = parseISODate(fim);
  if (!a || !b) return null;
  return diasEntre(a, b) + 1; // inclui o dia inicial
}

export function desvioReal(
  prevInicio: string | null,
  prevFim: string | null,
  realInicio: string | null,
  realFim: string | null,
): { tipo: "atraso" | "adiantado" | "igual"; dias: number | null } {
  const pi = parseISODate(prevInicio);
  const ri = parseISODate(realInicio);
  if (!pi || !ri) return { tipo: "igual", dias: null };
  const d = diasEntre(pi, ri);
  if (d > 0) return { tipo: "atraso", dias: d };
  if (d < 0) return { tipo: "adiantado", dias: -d };
  return { tipo: "igual", dias: 0 };
}

export function computarStatusDinamico(p: Processo): ProcessoStatus {
  // status persistido tem prioridade se concluido
  if (p.status === "concluido") return "concluido";
  const hoje = HOJE();
  const pi = parseISODate(p.previsto_inicio);
  const pf = parseISODate(p.previsto_fim);
  const ri = parseISODate(p.real_inicio);
  const rf = parseISODate(p.real_fim);
  if (rf && rf < hoje) return "concluido";
  // Já começou de fato e o fim real ainda não passou (vazio ou preenchido com data futura).
  // Antes exigia fim real vazio: um processo com fim real antecipado caía em "planejado".
  if (ri && ri <= hoje) return "em_andamento";
  if (pf && !rf && pf < hoje) return "atrasado";
  if (pi && !ri && pi <= hoje) return "em_andamento";
  return "planejado";
}

export function diasParaInicio(p: Processo): number | null {
  const pi = parseISODate(p.previsto_inicio);
  if (!pi) return null;
  return diasEntre(HOJE(), pi);
}
