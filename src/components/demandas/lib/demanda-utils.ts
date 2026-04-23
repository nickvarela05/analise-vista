import { differenceInCalendarDays, isPast, isToday } from "date-fns";

export const STATUS_OPTS = [
  "aberta",
  "em_analise",
  "em_andamento",
  "aguardando_cliente",
  "homologacao",
  "concluida",
  "cancelada",
] as const;

export type DemandaStatus = (typeof STATUS_OPTS)[number];

export const PRIORIDADE_OPTS = ["baixa", "media", "alta", "critica"] as const;
export type DemandaPrioridade = (typeof PRIORIDADE_OPTS)[number];

export const CATEGORIA_OPTS = [
  "bug",
  "melhoria",
  "nova_funcionalidade",
  "duvida",
  "documentacao",
  "outro",
] as const;
export type DemandaCategoria = (typeof CATEGORIA_OPTS)[number];

export const ORIGEM_OPTS = ["email", "reuniao", "chamado", "whatsapp", "outro"] as const;
export type DemandaOrigem = (typeof ORIGEM_OPTS)[number];

export const STATUS_LABEL: Record<DemandaStatus, string> = {
  aberta: "Aberta",
  em_analise: "Em análise",
  em_andamento: "Em andamento",
  aguardando_cliente: "Aguardando cliente",
  homologacao: "Homologação",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const KANBAN_STATUS: DemandaStatus[] = [
  "aberta",
  "em_analise",
  "em_andamento",
  "aguardando_cliente",
  "homologacao",
  "concluida",
];

export function statusBadgeClass(s: string) {
  if (s === "concluida") return "bg-success/15 text-success border-success/30";
  if (s === "cancelada") return "bg-muted text-muted-foreground border-border";
  if (s === "aberta") return "bg-info/15 text-info border-info/30";
  if (s === "homologacao") return "bg-warning/20 text-warning-foreground border-warning/30";
  if (s === "aguardando_cliente") return "bg-muted text-muted-foreground border-border";
  return "bg-primary/10 text-primary border-primary/20";
}

export function prioridadeBadgeClass(p: string) {
  if (p === "critica") return "bg-destructive/15 text-destructive border-destructive/30";
  if (p === "alta") return "bg-warning/20 text-warning-foreground border-warning/30";
  if (p === "media") return "bg-primary/10 text-primary border-primary/20";
  return "bg-muted text-muted-foreground border-border";
}

/** Returns a tailwind border-l color class to color the side of a card by priority */
export function prioridadeSideClass(p: string) {
  if (p === "critica") return "border-l-destructive";
  if (p === "alta") return "border-l-warning";
  if (p === "media") return "border-l-primary";
  return "border-l-muted-foreground/30";
}

export interface PrazoInfo {
  label: string;
  tone: "destructive" | "warning" | "info" | "muted";
  isAtrasada: boolean;
  isHoje: boolean;
}

export function describePrazo(prazo: string | null | undefined, status: string): PrazoInfo | null {
  if (!prazo) return null;
  const date = new Date(prazo + "T00:00:00");
  const isClosed = status === "concluida" || status === "cancelada";
  if (isToday(date)) {
    return { label: "Hoje", tone: isClosed ? "muted" : "warning", isAtrasada: false, isHoje: true };
  }
  if (isPast(date) && !isClosed) {
    const dias = Math.abs(differenceInCalendarDays(date, new Date()));
    return {
      label: `${dias}d em atraso`,
      tone: "destructive",
      isAtrasada: true,
      isHoje: false,
    };
  }
  const dias = differenceInCalendarDays(date, new Date());
  if (dias <= 3 && !isClosed) {
    return { label: `em ${dias}d`, tone: "warning", isAtrasada: false, isHoje: false };
  }
  return { label: `em ${dias}d`, tone: "info", isAtrasada: false, isHoje: false };
}

export function prazoBadgeClass(tone: PrazoInfo["tone"]) {
  switch (tone) {
    case "destructive":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "warning":
      return "bg-warning/20 text-warning-foreground border-warning/30";
    case "info":
      return "bg-info/10 text-info border-info/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}
