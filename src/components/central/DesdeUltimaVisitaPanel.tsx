import * as React from "react";
import { format } from "date-fns";
import { CheckCheck, ChevronDown, History, MessageSquare, PackagePlus, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { agruparStatus, contarLiberacoes } from "./lib/mudancas";
import type { Mudancas } from "./useMudancas";

const MAX_POR_GRUPO = 6;

/**
 * "Desde a sua última visita": o que outras pessoas fizeram enquanto você estava fora —
 * pacotes recebidos, mudanças de status, liberações e comentários nas suas tarefas.
 */
export function DesdeUltimaVisitaPanel({
  dados,
  onAbrir,
  onMarcarVisto,
}: {
  dados: Mudancas;
  onAbrir: (todoId: string) => void;
  onMarcarVisto: () => void;
}) {
  const grupos = React.useMemo(() => agruparStatus(dados.historico), [dados.historico]);
  const liberacoes = React.useMemo(() => contarLiberacoes(dados.historico), [dados.historico]);
  const [aberto, setAberto] = React.useState<string | null>(null);
  const vazio =
    grupos.length === 0 &&
    liberacoes === 0 &&
    dados.pacotes.length === 0 &&
    dados.comentarios.length === 0;
  const quando = format(new Date(dados.desde), "dd/MM 'às' HH:mm");

  if (vazio) {
    return (
      <p className="flex items-center gap-2 rounded-xl border bg-card/60 px-4 py-2.5 text-xs text-muted-foreground">
        <History className="h-3.5 w-3.5" /> Nada novo desde a sua última visita ({quando}).
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <History className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">Desde a sua última visita</p>
        <span className="text-xs text-muted-foreground">{quando}</span>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-7 gap-1 text-xs"
          onClick={onMarcarVisto}
        >
          <CheckCheck className="h-3.5 w-3.5" /> Marcar como visto
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {dados.pacotes.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs"
          >
            <PackagePlus className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
            Pacote recebido: <strong>{p.nome}</strong> ({p.total})
          </span>
        ))}
        {grupos.map((g) => (
          <button
            key={g.status}
            type="button"
            onClick={() => setAberto((a) => (a === g.status ? null : g.status))}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border bg-background/70 px-3 py-1 text-xs transition-colors hover:bg-muted",
              aberto === g.status && "border-primary/50 bg-primary/10",
            )}
          >
            <strong className="tabular-nums">{g.tarefas.length}</strong> {g.rotulo.toLowerCase()}
            <ChevronDown
              className={cn("h-3 w-3 transition-transform", aberto === g.status && "rotate-180")}
            />
          </button>
        ))}
        {liberacoes > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs">
            <Rocket className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
            <strong className="tabular-nums">{liberacoes}</strong> confirmaç
            {liberacoes === 1 ? "ão" : "ões"} de liberação
          </span>
        )}
      </div>

      {aberto && (
        <ul className="mt-3 space-y-1">
          {grupos
            .find((g) => g.status === aberto)
            ?.tarefas.slice(0, MAX_POR_GRUPO)
            .map((t) => (
              <li key={t.todo_id}>
                <button
                  type="button"
                  onClick={() => onAbrir(t.todo_id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-background/70"
                >
                  <span className="min-w-0 flex-1 truncate">{t.titulo}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {t.autor ?? "—"} · {format(new Date(t.em), "dd/MM HH:mm")}
                  </span>
                </button>
              </li>
            ))}
          {(grupos.find((g) => g.status === aberto)?.tarefas.length ?? 0) > MAX_POR_GRUPO && (
            <li className="px-2 text-[11px] text-muted-foreground">
              e mais{" "}
              {(grupos.find((g) => g.status === aberto)?.tarefas.length ?? 0) - MAX_POR_GRUPO}…
            </li>
          )}
        </ul>
      )}

      {dados.comentarios.length > 0 && (
        <div className="mt-3 space-y-1">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" /> Comentários nas suas tarefas
          </p>
          {dados.comentarios.slice(0, 4).map((c, i) => (
            <button
              key={`${c.todo_id}-${i}`}
              type="button"
              onClick={() => onAbrir(c.todo_id)}
              className="block w-full rounded-md px-2 py-1 text-left text-sm hover:bg-background/70"
            >
              <span className="font-medium">{c.autor ?? "—"}</span>
              <span className="text-muted-foreground"> em {c.titulo}: </span>
              <span className="line-clamp-1">{c.conteudo}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
