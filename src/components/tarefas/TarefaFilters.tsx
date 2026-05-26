import * as React from "react";
import { Search, X, FlaskConical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { agruparColaboradoresPorEquipe } from "@/lib/equipes";

export interface TarefaFiltersState {
  search: string;
  responsaveis: string[];
  prioridades: string[];
  prazo: "todos" | "atrasadas" | "hoje" | "semana" | "sem_prazo";
  comDemanda: "todos" | "sim" | "nao";
  origem: "todos" | "homologacao" | "manual";
  lotes: string[];
  emTeste: boolean;
}

export const initialFilters: TarefaFiltersState = {
  search: "",
  responsaveis: [],
  prioridades: [],
  prazo: "todos",
  comDemanda: "todos",
  origem: "todos",
  lotes: [],
  emTeste: false,
};

interface Props {
  value: TarefaFiltersState;
  onChange: (next: TarefaFiltersState) => void;
  colabs: { id: string; nome: string }[];
  lotes?: { id: string; nome: string }[];
}

export function TarefaFilters({ value, onChange, colabs, lotes = [] }: Props) {
  const activeCount =
    value.responsaveis.length +
    value.prioridades.length +
    (value.prazo !== "todos" ? 1 : 0) +
    (value.comDemanda !== "todos" ? 1 : 0) +
    (value.origem !== "todos" ? 1 : 0) +
    value.lotes.length +
    (value.emTeste ? 1 : 0);

  const togglePrio = (p: string) => {
    onChange({
      ...value,
      prioridades: value.prioridades.includes(p)
        ? value.prioridades.filter((x) => x !== p)
        : [...value.prioridades, p],
    });
  };

  const toggleResp = (id: string) => {
    onChange({
      ...value,
      responsaveis: value.responsaveis.includes(id)
        ? value.responsaveis.filter((x) => x !== id)
        : [...value.responsaveis, id],
    });
  };

  return (
    <div className="flex flex-1 flex-wrap items-center gap-2 sm:flex-none">
      <div className="relative flex-1 sm:flex-none">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar tarefas..."
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          className="h-9 w-full pl-8 sm:w-64"
        />
      </div>

      <Button
        type="button"
        variant={value.emTeste ? "default" : "outline"}
        size="sm"
        className="h-9"
        onClick={() => onChange({ ...value, emTeste: !value.emTeste })}
        title="Mostrar apenas tarefas em teste"
      >
        <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
        Em teste
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            Filtros
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">
                {activeCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Prioridade</Label>
              <div className="mt-1.5 flex gap-1.5">
                {["baixa", "media", "alta"].map((p) => (
                  <Button
                    key={p}
                    variant={value.prioridades.includes(p) ? "default" : "outline"}
                    size="sm"
                    className="h-7 flex-1 text-xs capitalize"
                    onClick={() => togglePrio(p)}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs">Prazo</Label>
              <Select value={value.prazo} onValueChange={(v) => onChange({ ...value, prazo: v as any })}>
                <SelectTrigger className="mt-1.5 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="atrasadas">Atrasadas</SelectItem>
                  <SelectItem value="hoje">Vencendo hoje</SelectItem>
                  <SelectItem value="semana">Próximos 7 dias</SelectItem>
                  <SelectItem value="sem_prazo">Sem prazo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Vínculo com demanda</Label>
              <Select
                value={value.comDemanda}
                onValueChange={(v) => onChange({ ...value, comDemanda: v as any })}
              >
                <SelectTrigger className="mt-1.5 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="sim">Vinculadas a demanda</SelectItem>
                  <SelectItem value="nao">Sem demanda</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Origem</Label>
              <Select value={value.origem} onValueChange={(v) => onChange({ ...value, origem: v as TarefaFiltersState["origem"] })}>
                <SelectTrigger className="mt-1.5 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="homologacao">Importadas (HML)</SelectItem>
                  <SelectItem value="manual">Manuais</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {lotes.length > 0 && (
              <div>
                <Label className="text-xs">Lotes de importação</Label>
                <ScrollArea className="mt-1.5 h-28 rounded-md border p-2">
                  <div className="space-y-0.5">
                    {lotes.map((l) => (
                      <label key={l.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-muted">
                        <Checkbox
                          checked={value.lotes.includes(l.id)}
                          onCheckedChange={() =>
                            onChange({
                              ...value,
                              lotes: value.lotes.includes(l.id)
                                ? value.lotes.filter((x) => x !== l.id)
                                : [...value.lotes, l.id],
                            })
                          }
                        />
                        <span className="truncate text-xs">{l.nome}</span>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            <div>
              <Label className="text-xs">Responsáveis</Label>
              <ScrollArea className="mt-1.5 h-40 rounded-md border p-2">
                {(() => {
                  const { grupos, outros } = agruparColaboradoresPorEquipe(colabs);
                  const renderItem = (c: { id: string; nome: string }) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-muted"
                    >
                      <Checkbox
                        checked={value.responsaveis.includes(c.id)}
                        onCheckedChange={() => toggleResp(c.id)}
                      />
                      <span className="text-xs">{c.nome}</span>
                    </label>
                  );
                  return (
                    <div className="space-y-2">
                      {grupos.map((g) =>
                        g.items.length === 0 ? null : (
                          <div key={g.label} className="space-y-0.5">
                            <p className="px-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {g.label}
                            </p>
                            {g.items.map(renderItem)}
                          </div>
                        ),
                      )}
                      {outros.length > 0 && (
                        <div className="space-y-0.5">
                          <p className="px-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Outros
                          </p>
                          {outros.map(renderItem)}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </ScrollArea>
            </div>

            {activeCount > 0 && (
              <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange(initialFilters)}>
                <X className="mr-1.5 h-3.5 w-3.5" /> Limpar filtros
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
