// Novo fluxo de workflow para tarefas
export const WORKFLOW = [
  "aberta",
  "em_andamento",
  "homologacao",
  "aprovado",
  "aprovado_ressalvas",
  "reprovado",
  "producao",
] as const;

export type WorkflowStatus = (typeof WORKFLOW)[number];

// Status legados que ainda podem existir no banco mas que mapeamos
export const ALL_STATUS = [
  ...WORKFLOW,
  "pendente",
  "concluida",
  "cancelada",
  "encaminhada",
] as const;

export const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em desenvolvimento/Teste interno",
  homologacao: "Homologação",
  aprovado: "Aprovado",
  aprovado_ressalvas: "Aprovado c/ ressalvas",
  reprovado: "Reprovado",
  producao: "Produção",
  pendente: "Pendente",
  concluida: "Concluída",
  cancelada: "Cancelada",
  encaminhada: "Encaminhada",
};

export const STATUS_DESCRIPTION: Record<string, string> = {
  aberta: "Aguardando início",
  em_andamento: "Em execução",
  homologacao: "Validação em andamento",
  aprovado: "Aprovado para produção",
  aprovado_ressalvas: "Aprovado com pendências",
  reprovado: "Necessita ajustes",
  producao: "Em ambiente produtivo (final)",
};

// Cores semânticas por status (usa tokens do design system)
export function statusVariant(s: string) {
  switch (s) {
    case "producao":
      return "bg-success/15 text-success border-success/30";
    case "aprovado":
      return "bg-success/10 text-success border-success/25";
    case "aprovado_ressalvas":
      return "bg-warning/20 text-warning border-warning/40";
    case "reprovado":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "homologacao":
      return "bg-info/15 text-info border-info/30";
    case "em_andamento":
      return "bg-primary/15 text-primary border-primary/30";
    case "aberta":
    case "pendente":
      return "bg-muted text-muted-foreground border-border";
    case "encaminhada":
      return "bg-warning/15 text-warning border-warning/30";
    case "concluida":
      return "bg-success/10 text-success border-success/20";
    case "cancelada":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

// Cor de fundo das colunas do Kanban (mais sutil)
export function columnAccent(s: string) {
  switch (s) {
    case "producao":
      return "border-t-success";
    case "aprovado":
      return "border-t-success";
    case "aprovado_ressalvas":
      return "border-t-warning";
    case "reprovado":
      return "border-t-destructive";
    case "homologacao":
      return "border-t-info";
    case "em_andamento":
      return "border-t-primary";
    case "aberta":
      return "border-t-muted-foreground/40";
    default:
      return "border-t-border";
  }
}

export function prioVariant(p: string) {
  if (p === "alta") return "bg-destructive/15 text-destructive border-destructive/30";
  if (p === "media") return "bg-warning/20 text-warning border-warning/30";
  return "bg-success/15 text-success border-success/30";
}

export const PRIO = ["baixa", "media", "alta"] as const;
export type Prio = (typeof PRIO)[number];

// Normaliza status legados para o Kanban
export function normalizeStatus(s: string): WorkflowStatus {
  if (s === "pendente") return "aberta";
  if (s === "concluida") return "producao";
  if (s === "encaminhada") return "homologacao";
  if (s === "cancelada") return "reprovado";
  return s as WorkflowStatus;
}
