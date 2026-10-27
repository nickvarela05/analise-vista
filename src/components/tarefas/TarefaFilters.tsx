import * as React from "react";
import {
  Search,
  X,
  FlaskConical,
  UserX,
  Users,
  Package,
  CalendarClock,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { agruparColaboradoresPorEquipe } from "@/lib/equipes";
import { cn, prioridadeLabel } from "@/lib/utils";
import { initialFilters } from "./lib/filtrosIniciais";

export interface TarefaFiltersState {
  search: string;
  responsaveis: string[];
  prioridades: string[];
  prazo: "todos" | "atrasadas" | "hoje" | "semana" | "sem_prazo";
  comDemanda: "todos" | "sim" | "nao";
  origem: "todos" | "homologacao" | "manual";
  lotes: string[];
  emTeste: boolean;
  semResponsavel: boolean;
}

interface Props {
  value: TarefaFiltersState;
  onChange: (next: TarefaFiltersState) => void;
  colabs: { id: string; nome: string }[];
  lotes?: { id: string; nome: string }[];
  /** Quantas tarefas cada atalho mostraria, para o número ao lado do botão. */
  contagens?: { emTeste: number; semResponsavel: number };
}

const PRAZOS: { valor: TarefaFiltersState["prazo"]; rotulo: string }[] = [
  { valor: "todos", rotulo: "Qualquer prazo" },
  { valor: "atrasadas", rotulo: "Atrasadas" },
  { valor: "hoje", rotulo: "Vencendo hoje" },
  { valor: "semana", rotulo: "Próximos 7 dias" },
  { valor: "sem_prazo", rotulo: "Sem prazo" },
];

const DEMANDA: Record<Exclude<TarefaFiltersState["comDemanda"], "todos">, string> = {
  sim: "Com demanda",
  nao: "Sem demanda",
};

const ORIGEM: Record<Exclude<TarefaFiltersState["origem"], "todos">, string> = {
  homologacao: "Importadas (HML)",
  manual: "Manuais",
};

const alternar = (lista: string[], item: string) =>
  lista.includes(item) ? lista.filter((x) => x !== item) : [...lista, item];

/**
 * Barra de filtros do quadro de tarefas (refeita em 27/10/2026, pedido do Nickolas: antes ficava
 * "tudo meio separado", com um botão solto e o resto escondido num balão). Os filtros mais usados
 * ficam à vista, os demais em "Mais filtros", e cada filtro ativo vira uma etiqueta removível.
 */
export function TarefaFilters({ value, onChange, colabs, lotes = [], contagens }: Props) {
  const set = (parcial: Partial<TarefaFiltersState>) => onChange({ ...value, ...parcial });

  const nomeColab = React.useMemo(() => new Map(colabs.map((c) => [c.id, c.nome])), [colabs]);
  const nomeLote = React.useMemo(() => new Map(lotes.map((l) => [l.id, l.nome])), [lotes]);
  const { grupos, outros } = React.useMemo(() => agruparColaboradoresPorEquipe(colabs), [colabs]);
  const gruposResp = [
    ...grupos.filter((g) => g.items.length > 0).map((g) => ({ rotulo: g.label, itens: g.items })),
    ...(outros.length > 0 ? [{ rotulo: "Outros", itens: outros }] : []),
  ];

  const maisAtivos =
    value.prioridades.length +
    (value.comDemanda !== "todos" ? 1 : 0) +
    (value.origem !== "todos" ? 1 : 0);

  // Etiquetas dos filtros ativos, cada uma com o que fazer para tirá-la.
  const etiquetas: { chave: string; texto: string; tirar: () => void }[] = [
    ...(value.search
      ? [{ chave: "busca", texto: `“${value.search}”`, tirar: () => set({ search: "" }) }]
      : []),
    ...(value.emTeste
      ? [{ chave: "teste", texto: "Em teste", tirar: () => set({ emTeste: false }) }]
      : []),
    ...(value.semResponsavel
      ? [
          {
            chave: "semresp",
            texto: "Sem responsável",
            tirar: () => set({ semResponsavel: false }),
          },
        ]
      : []),
    ...value.responsaveis.map((id) => ({
      chave: `r-${id}`,
      texto: nomeColab.get(id) ?? "Colaborador",
      tirar: () => set({ responsaveis: value.responsaveis.filter((x) => x !== id) }),
    })),
    ...value.lotes.map((id) => ({
      chave: `l-${id}`,
      texto: nomeLote.get(id) ?? "Pacote",
      tirar: () => set({ lotes: value.lotes.filter((x) => x !== id) }),
    })),
    ...(value.prazo !== "todos"
      ? [
          {
            chave: "prazo",
            texto: PRAZOS.find((p) => p.valor === value.prazo)?.rotulo ?? "Prazo",
            tirar: () => set({ prazo: "todos" }),
          },
        ]
      : []),
    ...value.prioridades.map((p) => ({
      chave: `p-${p}`,
      texto: `Prioridade ${prioridadeLabel(p).toLowerCase()}`,
      tirar: () => set({ prioridades: value.prioridades.filter((x) => x !== p) }),
    })),
    ...(value.comDemanda !== "todos"
      ? [
          {
            chave: "dem",
            texto: DEMANDA[value.comDemanda],
            tirar: () => set({ comDemanda: "todos" }),
          },
        ]
      : []),
    ...(value.origem !== "todos"
      ? [{ chave: "orig", texto: ORIGEM[value.origem], tirar: () => set({ origem: "todos" }) }]
      : []),
  ];

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-60">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar tarefas..."
            value={value.search}
            onChange={(e) => set({ search: e.target.value })}
            className="h-9 w-full pl-8"
          />
        </div>

        <FiltroLista
          icone={Users}
          rotulo="Responsável"
          selecionados={value.responsaveis}
          grupos={gruposResp}
          onAlternar={(id) => set({ responsaveis: alternar(value.responsaveis, id) })}
          onLimpar={() => set({ responsaveis: [] })}
        />

        {lotes.length > 0 && (
          <FiltroLista
            icone={Package}
            rotulo="Pacote"
            selecionados={value.lotes}
            grupos={[{ itens: lotes }]}
            onAlternar={(id) => set({ lotes: alternar(value.lotes, id) })}
            onLimpar={() => set({ lotes: [] })}
          />
        )}

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={value.prazo !== "todos" ? "secondary" : "outline"}
              size="sm"
              className="h-9"
            >
              <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
              {value.prazo === "todos"
                ? "Prazo"
                : PRAZOS.find((p) => p.valor === value.prazo)?.rotulo}
              <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="start">
            {PRAZOS.map((p) => (
              <button
                key={p.valor}
                type="button"
                onClick={() => set({ prazo: p.valor })}
                className={cn(
                  "w-full rounded px-2 py-1.5 text-left text-xs hover:bg-muted",
                  value.prazo === p.valor && "bg-muted font-medium",
                )}
              >
                {p.rotulo}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant={maisAtivos > 0 ? "secondary" : "outline"} size="sm" className="h-9">
              <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
              Mais filtros
              {maisAtivos > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                  {maisAtivos}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-3" align="start">
            <div>
              <Label className="text-xs">Prioridade</Label>
              <div className="mt-1.5 flex gap-1.5">
                {["baixa", "media", "alta"].map((p) => (
                  <Button
                    key={p}
                    variant={value.prioridades.includes(p) ? "default" : "outline"}
                    size="sm"
                    className="h-7 flex-1 text-xs"
                    onClick={() => set({ prioridades: alternar(value.prioridades, p) })}
                  >
                    {prioridadeLabel(p)}
                  </Button>
                ))}
              </div>
            </div>
            <Opcoes
              rotulo="Vínculo com demanda"
              valor={value.comDemanda}
              opcoes={[{ valor: "todos", rotulo: "Todas" }, ...entradas(DEMANDA)]}
              onEscolher={(v) => set({ comDemanda: v })}
            />
            <Opcoes
              rotulo="Origem"
              valor={value.origem}
              opcoes={[{ valor: "todos", rotulo: "Todas" }, ...entradas(ORIGEM)]}
              onEscolher={(v) => set({ origem: v })}
            />
          </PopoverContent>
        </Popover>

        <div className="mx-0.5 hidden h-6 w-px bg-border sm:block" />

        <Atalho
          ativo={value.emTeste}
          icone={FlaskConical}
          rotulo="Em teste"
          contagem={contagens?.emTeste}
          titulo="Só tarefas sinalizadas como em teste"
          onClick={() => set({ emTeste: !value.emTeste })}
        />
        <Atalho
          ativo={value.semResponsavel}
          icone={UserX}
          rotulo="Sem responsável"
          contagem={contagens?.semResponsavel}
          titulo="Só tarefas sem ninguém atribuído. Junto com “Em teste”, mostra os testes sem atribuição."
          onClick={() => set({ semResponsavel: !value.semResponsavel })}
        />
      </div>

      {etiquetas.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {etiquetas.map((e) => (
            <span
              key={e.chave}
              className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/10 py-0.5 pl-2 pr-1 text-xs text-foreground"
            >
              {e.texto}
              <button
                type="button"
                onClick={e.tirar}
                className="rounded p-0.5 text-muted-foreground hover:bg-primary/15 hover:text-foreground"
                aria-label={`Tirar o filtro ${e.texto}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={() => onChange(initialFilters)}
          >
            Limpar tudo
          </Button>
        </div>
      )}
    </div>
  );
}

function entradas<K extends string>(r: Record<K, string>) {
  return (Object.keys(r) as K[]).map((valor) => ({ valor, rotulo: r[valor] }));
}

function Atalho({
  ativo,
  icone: Icone,
  rotulo,
  contagem,
  titulo,
  onClick,
}: {
  ativo: boolean;
  icone: typeof Search;
  rotulo: string;
  contagem?: number;
  titulo: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={ativo ? "default" : "outline"}
      size="sm"
      className="h-9"
      onClick={onClick}
      title={titulo}
      aria-pressed={ativo}
    >
      <Icone className="mr-1.5 h-3.5 w-3.5" />
      {rotulo}
      {contagem !== undefined && (
        <span className={cn("ml-1.5 tabular-nums", ativo ? "opacity-90" : "text-muted-foreground")}>
          {contagem}
        </span>
      )}
    </Button>
  );
}

/** Botão que abre uma lista de marcar (responsáveis, pacotes). */
function FiltroLista({
  icone: Icone,
  rotulo,
  selecionados,
  grupos,
  onAlternar,
  onLimpar,
}: {
  icone: typeof Search;
  rotulo: string;
  selecionados: string[];
  grupos: { rotulo?: string; itens: { id: string; nome: string }[] }[];
  onAlternar: (id: string) => void;
  onLimpar: () => void;
}) {
  const [busca, setBusca] = React.useState("");
  const termo = busca.trim().toLowerCase();
  const total = grupos.reduce((n, g) => n + g.itens.length, 0);
  return (
    <Popover onOpenChange={(aberto) => !aberto && setBusca("")}>
      <PopoverTrigger asChild>
        <Button
          variant={selecionados.length > 0 ? "secondary" : "outline"}
          size="sm"
          className="h-9"
        >
          <Icone className="mr-1.5 h-3.5 w-3.5" />
          {rotulo}
          {selecionados.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
              {selecionados.length}
            </Badge>
          )}
          <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        {total > 8 && (
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Procurar..."
            className="mb-2 h-8 text-xs"
          />
        )}
        <ScrollArea className="h-60">
          <div className="space-y-2 pr-2">
            {grupos.map((g, i) => {
              const itens = termo
                ? g.itens.filter((c) => c.nome.toLowerCase().includes(termo))
                : g.itens;
              if (itens.length === 0) return null;
              return (
                <div key={g.rotulo ?? i} className="space-y-0.5">
                  {g.rotulo && (
                    <p className="px-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {g.rotulo}
                    </p>
                  )}
                  {itens.map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-muted"
                    >
                      <Checkbox
                        checked={selecionados.includes(c.id)}
                        onCheckedChange={() => onAlternar(c.id)}
                      />
                      <span className="truncate text-xs">{c.nome}</span>
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        </ScrollArea>
        {selecionados.length > 0 && (
          <Button variant="ghost" size="sm" className="mt-1 h-7 w-full text-xs" onClick={onLimpar}>
            Limpar {rotulo.toLowerCase()}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Opcoes<V extends string>({
  rotulo,
  valor,
  opcoes,
  onEscolher,
}: {
  rotulo: string;
  valor: V;
  opcoes: { valor: V; rotulo: string }[];
  onEscolher: (v: V) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{rotulo}</Label>
      <div className="mt-1.5 flex gap-1.5">
        {opcoes.map((o) => (
          <Button
            key={o.valor}
            variant={valor === o.valor ? "default" : "outline"}
            size="sm"
            className="h-7 flex-1 px-1 text-[11px]"
            onClick={() => onEscolher(o.valor)}
          >
            {o.rotulo}
          </Button>
        ))}
      </div>
    </div>
  );
}
