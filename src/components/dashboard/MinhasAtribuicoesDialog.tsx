import * as React from "react";
import { format, isBefore, isToday, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CalendarDays,
  CheckSquare,
  Clock,
  FileText,
  Inbox,
  ListChecks,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PreviewItem } from "@/components/PreviewDialog";
import { isAtribuidoA } from "@/lib/domain/atividades";
import type { TarefaRow, DemandaRow, ReuniaoRow, ChamadoRow } from "@/lib/db-types";

const STATUS_CONCLUIDOS = new Set([
  "concluida",
  "cancelada",
  "finalizado",
  "realizada",
  "producao",
  "aprovado",
]);

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nome: string | null;
  colabId: string | null;
  tarefas: TarefaRow[];
  demandas: DemandaRow[];
  reunioes: ReuniaoRow[];
  chamados: ChamadoRow[];
  onOpenItem: (item: PreviewItem) => void;
}

type Tone = "primary" | "warning" | "info" | "success";

const TONE: Record<
  Tone,
  { ring: string; bg: string; text: string; chip: string; dot: string }
> = {
  primary: {
    ring: "ring-primary/30",
    bg: "bg-primary/10",
    text: "text-primary",
    chip: "border-primary/30 bg-primary/10 text-primary",
    dot: "bg-primary",
  },
  warning: {
    ring: "ring-amber-500/30",
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    chip:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  info: {
    ring: "ring-sky-500/30",
    bg: "bg-sky-500/10",
    text: "text-sky-600 dark:text-sky-400",
    chip: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  success: {
    ring: "ring-emerald-500/30",
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    chip:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
};

function MinhasAtribuicoesDialogImpl({
  open,
  onOpenChange,
  nome,
  colabId,
  tarefas,
  demandas,
  reunioes,
  chamados,
  onOpenItem,
}: Props) {
  const { minhasTarefas, minhasDemandas, minhasReunioes, meusChamados, total } =
    React.useMemo(() => {
      const filterFn = (r: any) => (colabId ? isAtribuidoA(r, colabId) : false);
      const mt = tarefas.filter(filterFn);
      const md = demandas.filter(filterFn);
      const mr = reunioes.filter(filterFn);
      const mc = chamados.filter(filterFn);
      return {
        minhasTarefas: mt,
        minhasDemandas: md,
        minhasReunioes: mr,
        meusChamados: mc,
        total: mt.length + md.length + mr.length + mc.length,
      };
    }, [tarefas, demandas, reunioes, chamados, colabId]);

  const countAtrasadas = React.useMemo(() => {
    const today = startOfDay(new Date());
    const overdue = (rows: any[], key: string) =>
      rows.filter((r) => {
        const dt = r[key] ? new Date(r[key]) : null;
        const done = STATUS_CONCLUIDOS.has((r.status ?? "").toLowerCase());
        return dt && isBefore(dt, today) && !done;
      }).length;
    return (
      overdue(minhasTarefas, "data_prevista") +
      overdue(minhasDemandas, "prazo") +
      overdue(minhasReunioes, "data_reuniao") +
      overdue(meusChamados, "prazo")
    );
  }, [minhasTarefas, minhasDemandas, minhasReunioes, meusChamados]);

  const renderGroupedList = (
    items: any[],
    tipo: PreviewItem["tipo"],
    dataKey: string,
    dataLabel: string,
    Icon: any,
    tone: Tone,
  ) => {
    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
          <div className={cn("rounded-full p-3", TONE[tone].bg)}>
            <Sparkles className={cn("h-5 w-5", TONE[tone].text)} />
          </div>
          <p className="text-sm font-medium">Tudo em dia</p>
          <p className="text-xs text-muted-foreground">
            Nenhum item atribuído nesta categoria.
          </p>
        </div>
      );
    }

    const today = startOfDay(new Date());
    const groups: { key: string; label: string; items: any[]; icon: any; accent: string }[] = [
      { key: "atrasadas", label: "Atrasadas", items: [], icon: AlertTriangle, accent: "text-destructive" },
      { key: "hoje", label: "Hoje", items: [], icon: Clock, accent: "text-amber-500" },
      { key: "futuras", label: "Próximas", items: [], icon: CalendarDays, accent: "text-muted-foreground" },
      { key: "semdata", label: "Sem data", items: [], icon: Inbox, accent: "text-muted-foreground" },
    ];

    for (const it of items) {
      const dt = it[dataKey] ? new Date(it[dataKey]) : null;
      const done = STATUS_CONCLUIDOS.has((it.status ?? "").toLowerCase());
      if (!dt) groups[3].items.push(it);
      else if (isBefore(dt, today) && !done) groups[0].items.push(it);
      else if (isToday(dt)) groups[1].items.push(it);
      else groups[2].items.push(it);
    }

    for (const g of groups) {
      g.items.sort((a, b) => {
        const da = a[dataKey] ? new Date(a[dataKey]).getTime() : Infinity;
        const db = b[dataKey] ? new Date(b[dataKey]).getTime() : Infinity;
        return da - db;
      });
    }

    return (
      <div className="space-y-5">
        {groups
          .filter((g) => g.items.length > 0)
          .map((g) => {
            const GIcon = g.icon;
            return (
              <section key={g.key}>
                <header className="mb-2 flex items-center gap-2 px-0.5">
                  <GIcon className={cn("h-3.5 w-3.5", g.accent)} />
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {g.label}
                  </h4>
                  <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                    · {g.items.length}
                  </span>
                  <div className="ml-2 h-px flex-1 bg-border/60" />
                </header>
                <ul className="space-y-1.5">
                  {g.items.map((it) => {
                    const dt = it[dataKey] ? new Date(it[dataKey]) : null;
                    const atrasada = g.key === "atrasadas";
                    const isPrio =
                      it.prioridade === "alta" || it.prioridade === "critica";
                    return (
                      <li key={it.id}>
                        <button
                          type="button"
                          onClick={() =>
                            onOpenItem({
                              id: it.id,
                              tipo,
                              titulo: it.titulo,
                              descricao: it.descricao ?? it.pauta ?? null,
                              status: it.status,
                              prioridade: it.prioridade,
                              data: dt ?? undefined,
                              dataLabel,
                              tags: it.tags,
                            })
                          }
                          className={cn(
                            "group relative flex w-full items-start gap-3 overflow-hidden rounded-lg border bg-card px-3 py-2.5 text-left transition-all",
                            "hover:border-foreground/20 hover:shadow-sm hover:-translate-y-[1px]",
                            atrasada
                              ? "border-destructive/30 bg-destructive/[0.03]"
                              : "border-border/70",
                          )}
                        >
                          <span
                            className={cn(
                              "absolute inset-y-0 left-0 w-[3px]",
                              atrasada
                                ? "bg-destructive"
                                : isPrio
                                  ? "bg-amber-500"
                                  : TONE[tone].dot,
                            )}
                            aria-hidden
                          />
                          <div
                            className={cn(
                              "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1",
                              atrasada
                                ? "bg-destructive/10 ring-destructive/30 text-destructive"
                                : cn(TONE[tone].bg, TONE[tone].ring, TONE[tone].text),
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="line-clamp-2 text-sm font-medium leading-snug">
                                {it.titulo}
                              </p>
                              <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 text-[11px]",
                                  atrasada
                                    ? "text-destructive font-medium"
                                    : "text-muted-foreground",
                                )}
                              >
                                <Clock className="h-3 w-3" />
                                {dt
                                  ? `${dataLabel}: ${format(dt, "EEE, dd/MM 'às' HH:mm", { locale: ptBR })}`
                                  : "Sem data definida"}
                              </span>
                              {atrasada && (
                                <Badge
                                  variant="destructive"
                                  className="h-4 px-1.5 text-[9px] uppercase tracking-wider"
                                >
                                  Atrasada
                                </Badge>
                              )}
                              {isPrio && (
                                <Badge
                                  className="h-4 border-amber-500/40 bg-amber-500/10 px-1.5 text-[9px] uppercase tracking-wider text-amber-700 dark:text-amber-300"
                                  variant="outline"
                                >
                                  {it.prioridade}
                                </Badge>
                              )}
                              {it.status && (
                                <Badge
                                  variant="outline"
                                  className="h-4 px-1.5 text-[9px] uppercase tracking-wider text-muted-foreground"
                                >
                                  {it.status}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
      </div>
    );
  };

  const tabs: {
    key: string;
    label: string;
    icon: any;
    count: number;
    tone: Tone;
    list: any[];
    tipo: PreviewItem["tipo"];
    dataKey: string;
    dataLabel: string;
  }[] = [
    {
      key: "tarefas",
      label: "Tarefas",
      icon: CheckSquare,
      count: minhasTarefas.length,
      tone: "primary",
      list: minhasTarefas,
      tipo: "tarefa",
      dataKey: "data_prevista",
      dataLabel: "Prazo",
    },
    {
      key: "demandas",
      label: "Demandas",
      icon: Inbox,
      count: minhasDemandas.length,
      tone: "warning",
      list: minhasDemandas,
      tipo: "demanda",
      dataKey: "prazo",
      dataLabel: "Prazo",
    },
    {
      key: "reunioes",
      label: "Reuniões",
      icon: Calendar,
      count: minhasReunioes.length,
      tone: "info",
      list: minhasReunioes,
      tipo: "reuniao",
      dataKey: "data_reuniao",
      dataLabel: "Quando",
    },
    {
      key: "relatorios",
      label: "Relatórios",
      icon: FileText,
      count: meusChamados.length,
      tone: "success",
      list: meusChamados,
      tipo: "chamado",
      dataKey: "prazo",
      dataLabel: "Prazo",
    },
  ];

  const defaultTab = tabs.find((t) => t.count > 0)?.key ?? "tarefas";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-hidden p-0">
        {/* Hero header */}
        <div className="relative overflow-hidden border-b bg-gradient-to-br from-primary/[0.08] via-background to-background px-6 pt-6 pb-5">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl"
            aria-hidden
          />
          <DialogHeader className="space-y-2 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
                <ListChecks className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold">
                  Minhas atribuições
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {nome ? `${nome} · ` : ""}
                  Visão consolidada do que está sob sua responsabilidade.
                </DialogDescription>
              </div>
            </div>

            {/* Summary pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-xs font-medium backdrop-blur">
                <span className="tabular-nums">{total}</span>
                <span className="text-muted-foreground">no total</span>
              </span>
              {countAtrasadas > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                  <AlertTriangle className="h-3 w-3" />
                  <span className="tabular-nums">{countAtrasadas}</span>
                  <span>atrasada{countAtrasadas > 1 ? "s" : ""}</span>
                </span>
              )}
              {total > 0 && countAtrasadas === 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  <Sparkles className="h-3 w-3" />
                  Nada atrasado
                </span>
              )}
            </div>
          </DialogHeader>
        </div>

        {total === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="rounded-full bg-emerald-500/10 p-4">
              <Sparkles className="h-6 w-6 text-emerald-500" />
            </div>
            <p className="text-base font-medium">Nada por aqui 🎉</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Você não tem itens atribuídos no momento. Aproveite para revisar
              suas próximas entregas ou planejar a semana.
            </p>
          </div>
        ) : (
          <Tabs defaultValue={defaultTab} className="w-full">
            <div className="border-b bg-muted/30 px-6 pt-3">
              <TabsList className="h-auto w-full justify-start gap-1 bg-transparent p-0">
                {tabs.map((t) => {
                  const TIcon = t.icon;
                  return (
                    <TabsTrigger
                      key={t.key}
                      value={t.key}
                      className={cn(
                        "group relative h-9 gap-1.5 rounded-t-md rounded-b-none border border-b-0 border-transparent bg-transparent px-3 text-xs font-medium text-muted-foreground",
                        "data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-none",
                      )}
                    >
                      <TIcon
                        className={cn(
                          "h-3.5 w-3.5",
                          `group-data-[state=active]:${TONE[t.tone].text}`,
                        )}
                      />
                      {t.label}
                      <span
                        className={cn(
                          "ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full border px-1 text-[10px] font-semibold tabular-nums",
                          t.count > 0
                            ? cn(TONE[t.tone].chip)
                            : "border-border/60 bg-muted text-muted-foreground",
                        )}
                      >
                        {t.count}
                      </span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
              {tabs.map((t) => (
                <TabsContent key={t.key} value={t.key} className="mt-0">
                  {renderGroupedList(
                    t.list,
                    t.tipo,
                    t.dataKey,
                    t.dataLabel,
                    t.icon,
                    t.tone,
                  )}
                </TabsContent>
              ))}
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

export const MinhasAtribuicoesDialog = React.memo(MinhasAtribuicoesDialogImpl);
