import type { ReactNode } from "react";
import { format } from "date-fns";
import { AlertTriangle, PackageOpen } from "lucide-react";
import { Panel } from "@/components/KpiTile";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TarefaRow } from "@/lib/db-types";
import type { ResumoRodada } from "./lib/central";

const SEGMENTOS = [
  { chave: "aprovadas", rotulo: "Aprovadas", cor: "bg-emerald-500" },
  { chave: "ressalvas", rotulo: "Com ressalvas", cor: "bg-amber-500" },
  { chave: "reprovadas", rotulo: "Reprovadas", cor: "bg-rose-500" },
  { chave: "aTestar", rotulo: "A testar", cor: "bg-muted-foreground/25" },
] as const;

/** Progresso da rodada atual, os pacotes que a compõem e as reprovadas (que travam o envio). */
export function RodadaPanel({
  resumo,
  reprovadas,
  nomeDe,
  onOpen,
  actions,
  tv = false,
}: {
  resumo: ResumoRodada;
  reprovadas: TarefaRow[];
  nomeDe: (t: TarefaRow) => string;
  onOpen: (t: TarefaRow) => void;
  actions?: ReactNode;
  tv?: boolean;
}) {
  if (resumo.total === 0) {
    return (
      <Panel title="Rodada atual" actions={actions}>
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <PackageOpen className="h-8 w-8 text-muted-foreground/60" />
          <p className="text-sm font-medium">Nenhuma tarefa em teste</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Quando o e-mail de homologação chegar, use <strong>Receber pacote</strong> e cole a
            tabela.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Rodada atual"
      hint="Tarefas recebidas e ainda não enviadas: em Homologação, Aprovadas, Com ressalvas ou Reprovadas. Saem daqui no Fechar rodada."
      actions={actions}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className={cn("font-semibold tabular-nums", tv ? "text-4xl" : "text-3xl")}>
          {resumo.pct}%
          <span className="ml-2 text-sm font-normal text-muted-foreground">testado</span>
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {resumo.total - resumo.aTestar} de {resumo.total} tarefas
        </p>
      </div>

      <div
        className="mt-3 flex h-3 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${resumo.pct}% testado`}
      >
        {SEGMENTOS.map((s) =>
          resumo[s.chave] > 0 ? (
            <div
              key={s.chave}
              className={s.cor}
              style={{ width: `${(resumo[s.chave] / resumo.total) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {SEGMENTOS.map((s) => (
          <li key={s.chave} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", s.cor)} />
            {s.rotulo} <span className="font-semibold tabular-nums">{resumo[s.chave]}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Pacotes
        </p>
        {resumo.lotes.map((l) => (
          <div
            key={l.id ?? "sem"}
            className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-1.5 text-sm"
          >
            <span className="min-w-0 truncate">
              {l.nome}
              {l.criadoEm && (
                <span className="ml-2 text-xs text-muted-foreground">
                  recebido em {format(new Date(l.criadoEm), "dd/MM")}
                </span>
              )}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {l.aTestar > 0 ? `${l.aTestar} a testar de ${l.total}` : `${l.total} testadas`}
            </span>
          </div>
        ))}
      </div>

      {reprovadas.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            Reprovadas: aguardam correção do desenvolvimento antes do envio
          </p>
          {reprovadas.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onOpen(t)}
              disabled={tv}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-1.5 text-left text-sm transition-colors hover:bg-rose-500/10 disabled:cursor-default"
            >
              <span className="min-w-0 truncate">{t.titulo}</span>
              <span className="flex shrink-0 items-center gap-1.5">
                {t.sistema && (
                  <Badge variant="outline" className="text-[10px]">
                    {t.sistema}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">{nomeDe(t)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}
