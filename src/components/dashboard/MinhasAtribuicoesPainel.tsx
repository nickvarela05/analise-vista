import * as React from "react";
import { Link } from "@tanstack/react-router";
import { format, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowRight,
  Calendar,
  CheckSquare,
  FileText,
  Inbox,
  ListChecks,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/KpiTile";
import { cn } from "@/lib/utils";
import { isAtribuidoA } from "@/lib/domain/atividades";
import type { TarefaRow, DemandaRow, ReuniaoRow, ChamadoRow } from "@/lib/db-types";

const TONE_BADGE: Record<string, string> = {
  primary: "border-primary/30 bg-primary/10 text-primary",
  info: "border-info/30 bg-info/10 text-info",
  warning: "border-warning/40 bg-warning/10 text-warning",
  success: "border-success/30 bg-success/10 text-success",
};

const STATUS_CONCLUIDOS = new Set([
  "concluida",
  "cancelada",
  "finalizado",
  "realizada",
  "producao",
  "aprovado",
]);

interface Props {
  nome: string | null;
  colabId: string;
  tarefas: TarefaRow[];
  demandas: DemandaRow[];
  reunioes: ReuniaoRow[];
  chamados: ChamadoRow[];
  onVerTodas: () => void;
  compact?: boolean;
}

function MinhasAtribuicoesPainelImpl({
  nome,
  colabId,
  tarefas,
  demandas,
  reunioes,
  chamados,
  onVerTodas,
  compact = false,
}: Props) {
  const maxItems = compact ? 3 : 4;
  const { minhasTarefas, minhasDemandas, minhasReunioes, meusChamados, total } =
    React.useMemo(() => {
      const mt = tarefas.filter((r) => isAtribuidoA(r, colabId));
      const md = demandas.filter((r) => isAtribuidoA(r, colabId));
      const mr = reunioes.filter((r) => isAtribuidoA(r, colabId));
      const mc = chamados.filter((r) => isAtribuidoA(r, colabId));
      return {
        minhasTarefas: mt,
        minhasDemandas: md,
        minhasReunioes: mr,
        meusChamados: mc,
        total: mt.length + md.length + mr.length + mc.length,
      };
    }, [tarefas, demandas, reunioes, chamados, colabId]);

  const grupos: {
    label: string;
    icon: any;
    items: any[];
    to: "/tarefas" | "/demandas" | "/reunioes" | "/relatorios";
    dataKey: string;
    dataLabel: string;
    tone: "primary" | "info" | "warning" | "success";
  }[] = [
    {
      label: "Tarefas",
      icon: CheckSquare,
      items: minhasTarefas,
      to: "/tarefas",
      dataKey: "data_prevista",
      dataLabel: "Prazo",
      tone: "primary",
    },
    {
      label: "Demandas",
      icon: Inbox,
      items: minhasDemandas,
      to: "/demandas",
      dataKey: "prazo",
      dataLabel: "Prazo",
      tone: "warning",
    },
    {
      label: "Reuniões",
      icon: Calendar,
      items: minhasReunioes,
      to: "/reunioes",
      dataKey: "data_reuniao",
      dataLabel: "Quando",
      tone: "info",
    },
    {
      label: "Relatórios",
      icon: FileText,
      items: meusChamados,
      to: "/relatorios",
      dataKey: "prazo",
      dataLabel: "Prazo",
      tone: "success",
    },
  ];

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          Minhas atribuições
          <Badge variant="secondary" className="ml-1 h-5 text-[10px]">
            {total}
          </Badge>
        </span>
      }
      actions={
        <div className="flex items-center gap-3">
          {nome && (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {nome}
            </span>
          )}
          <button
            type="button"
            onClick={onVerTodas}
            className="text-xs font-medium text-primary hover:underline"
          >
            Ver tudo →
          </button>
        </div>
      }
    >
      {total === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Você não possui itens atribuídos no momento. 🎉
        </p>
      ) : (
        <div className={cn("grid gap-3 md:grid-cols-2 xl:grid-cols-4", compact && "gap-2")}>
          {grupos.map((g) => {
            const Icon = g.icon;
            const sorted = [...g.items].sort((a, b) => {
              const da = a[g.dataKey] ? new Date(a[g.dataKey]).getTime() : Infinity;
              const db = b[g.dataKey] ? new Date(b[g.dataKey]).getTime() : Infinity;
              return da - db;
            });
            return (
              <div key={g.label} className={cn("flex flex-col rounded-lg border bg-muted/20", compact ? "p-2" : "p-3")}>
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
                      TONE_BADGE[g.tone],
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {g.label}
                    <span className="ml-1 rounded bg-background/60 px-1 tabular-nums">
                      {g.items.length}
                    </span>
                  </span>
                  <Link
                    to={g.to}
                    className="text-[10px] font-medium text-primary hover:underline"
                  >
                    Abrir →
                  </Link>
                </div>
                {sorted.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    Nenhum item.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {sorted.slice(0, maxItems).map((it) => {
                      const dt = it[g.dataKey] ? new Date(it[g.dataKey]) : null;
                      const concluido = STATUS_CONCLUIDOS.has(
                        (it.status ?? "").toLowerCase(),
                      );
                      const atrasada =
                        dt && isBefore(dt, startOfDay(new Date())) && !concluido;
                      return (
                        <li key={it.id}>
                          <Link
                            to={g.to}
                            className={cn(
                              "list-item-interactive group w-full text-left",
                              atrasada && "border-l-2 border-l-destructive bg-destructive/5",
                            )}
                          >
                            <Icon
                              className={cn(
                                "mt-0.5 h-3.5 w-3.5 shrink-0",
                                atrasada ? "text-destructive" : "text-muted-foreground",
                              )}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate text-xs font-medium">
                                  {it.titulo}
                                </span>
                                {atrasada && (
                                  <Badge
                                    variant="destructive"
                                    className="text-[9px] uppercase"
                                  >
                                    Atrasada
                                  </Badge>
                                )}
                              </div>
                              <p
                                className={cn(
                                  "mt-0.5 text-[10px]",
                                  atrasada
                                    ? "text-destructive/80"
                                    : "text-muted-foreground",
                                )}
                              >
                                {dt
                                  ? `${g.dataLabel}: ${format(dt, "dd/MM HH:mm", { locale: ptBR })}`
                                  : "Sem data"}
                                {it.status && ` · ${it.status}`}
                              </p>
                            </div>
                            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                          </Link>
                        </li>
                      );
                    })}
                    {g.items.length > maxItems && (
                      <li>
                        <button
                          type="button"
                          onClick={onVerTodas}
                          className="block w-full py-1 text-center text-[10px] font-medium text-primary hover:underline"
                        >
                          + {g.items.length - 4} mais
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

export const MinhasAtribuicoesPainel = React.memo(MinhasAtribuicoesPainelImpl);
