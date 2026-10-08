import { Panel } from "@/components/KpiTile";
import { cn } from "@/lib/utils";
import type { FilaPessoa } from "./lib/central";

/** Quanto cada pessoa ainda tem para testar na rodada, e quanto já testou. */
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
      hint="Tarefas da rodada atual por responsável. Tarefa com dois responsáveis conta para os dois."
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
                    className="bg-emerald-500"
                    style={{ width: `${(p.testadas / total) * 100}%` }}
                  />
                  <div
                    className={semDono ? "bg-amber-500/60" : "bg-sky-500/50"}
                    style={{ width: `${(p.aTestar / total) * 100}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
