import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Esqueletos com a forma de cada tela, no lugar da rodinha girando (23/10/2026). A pessoa vê
 * onde as coisas vão aparecer, e a troca para o conteúdo não faz a página pular.
 */

/** Colunas do Kanban com cartões de alturas diferentes (Tarefas, Demandas). */
export function EsqueletoKanban({ colunas = 4 }: { colunas?: number }) {
  const alturas = [92, 120, 76, 104, 88];
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${colunas}, minmax(220px, 1fr))` }}
      aria-busy="true"
      aria-label="Carregando"
    >
      {Array.from({ length: colunas }, (_, c) => (
        <div key={c} className="space-y-2.5 rounded-2xl border border-border/60 bg-card/60 p-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-6" />
          </div>
          {Array.from({ length: 3 - (c % 2) }, (_, i) => (
            <Skeleton
              key={i}
              className="w-full rounded-xl"
              style={{ height: alturas[(c + i) % alturas.length] }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Linhas de uma lista ou tabela (Relatórios). */
export function EsqueletoLista({ linhas = 6, className }: { linhas?: number; className?: string }) {
  return (
    <div
      className={cn("space-y-1 rounded-2xl border border-border/60 bg-card p-3", className)}
      aria-busy="true"
      aria-label="Carregando"
    >
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg px-2 py-2.5">
          <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5" style={{ width: `${55 + ((i * 17) % 35)}%` }} />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-5 w-16 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/** Grade de cartões (Reuniões). */
export function EsqueletoCartoes({ quantidade = 6 }: { quantidade?: number }) {
  return (
    <div
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      aria-busy="true"
      aria-label="Carregando"
    >
      {Array.from({ length: quantidade }, (_, i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/** A página inteira enquanto o login é conferido: título, indicadores e dois painéis. */
export function EsqueletoPagina() {
  return (
    <div className="space-y-5 p-3 sm:p-4 lg:p-6" aria-busy="true" aria-label="Carregando">
      <div className="space-y-2 pt-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-56" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-[92px] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}

/** Os 12 meses da aba "Ano" de Processos. */
export function EsqueletoAno() {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
      aria-busy="true"
      aria-label="Carregando"
    >
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
          <Skeleton className="h-4 w-24" />
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 35 }, (_, d) => (
              <Skeleton key={d} className="aspect-square rounded-md" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
