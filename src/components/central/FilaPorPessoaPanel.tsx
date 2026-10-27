import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Panel } from "@/components/KpiTile";
import { cn } from "@/lib/utils";
import type { FilaPessoa } from "./lib/central";

/**
 * Quanto cada pessoa ainda tem para testar na rodada, e quanto já testou. Fora da TV, cada linha
 * abre Tarefas filtrada pela pessoa ou pelas tarefas sem responsável (27/10/2026).
 */
export function FilaPorPessoaPanel({
  fila,
  minhaChave,
  tv = false,
}: {
  fila: FilaPessoa[];
  minhaChave?: string | null;
  tv?: boolean;
}) {
  return (
    <Panel
      title="Fila de testes por pessoa"
      hint="Tarefas da rodada atual por responsável. Tarefa com dois responsáveis conta para os dois. Clique numa pessoa para ver as tarefas dela."
    >
      {fila.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">Nenhuma tarefa na rodada.</p>
      ) : (
        <ul className="space-y-2.5">
          {fila.map((p) => {
            const total = p.aTestar + p.testadas;
            const semDono = p.chave === "sem";
            return (
              <li key={p.chave}>
                <LinhaFila chave={p.chave} clicavel={!tv}>
                  <div
                    className={cn(
                      "mb-1 flex items-baseline justify-between gap-2",
                      tv ? "text-base" : "text-sm",
                    )}
                  >
                    <span
                      className={cn(
                        "truncate",
                        p.chave === minhaChave && "font-semibold",
                        semDono && "font-medium text-amber-600 dark:text-amber-400",
                      )}
                    >
                      {p.nome}
                      {p.chave === minhaChave && (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          (você)
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      <strong
                        className={cn(
                          "text-foreground",
                          p.aTestar === 0 && "text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {p.aTestar === 0 ? "em dia" : `${p.aTestar} a testar`}
                      </strong>
                      {" · "}
                      {p.testadas} testada{p.testadas === 1 ? "" : "s"}
                      {p.reprovadas > 0 && (
                        <span className="text-rose-600 dark:text-rose-400">
                          {" "}
                          · {p.reprovadas} reprovada{p.reprovadas === 1 ? "" : "s"}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="animate-grow-x bg-emerald-500"
                      style={{ width: `${(p.testadas / total) * 100}%` }}
                    />
                    <div
                      className={`animate-grow-x ${semDono ? "bg-amber-500/60" : "bg-sky-500/50"}`}
                      style={{ width: `${(p.aTestar / total) * 100}%` }}
                    />
                  </div>
                </LinhaFila>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/** Linha da fila: link para Tarefas filtrada, menos na TV e na "Equipe toda". */
function LinhaFila({
  chave,
  clicavel,
  children,
}: {
  chave: string;
  clicavel: boolean;
  children: ReactNode;
}) {
  if (!clicavel || chave === "equipe") return <>{children}</>;
  return (
    <Link
      to="/tarefas"
      search={chave === "sem" ? { semResponsavel: true } : { responsavel: chave }}
      className="group -mx-2 block rounded-lg px-2 py-1 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title="Ver as tarefas no quadro"
    >
      {children}
    </Link>
  );
}
