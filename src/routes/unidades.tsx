import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import {
  Building2, MapPin, School, Layers, Search, X, Download, FileSpreadsheet,
  FileText, Filter, LayoutGrid, List, Hash, Map as MapIcon, Compass, Sparkles, Briefcase,
  ChevronRight, Users2, Loader2,
} from "lucide-react";
import * as XLSX from "xlsx";
import { AppLayout } from "@/components/AppLayout";
import { PageHero } from "@/components/shared/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/unidades")({
  component: () => (
    <AppLayout>
      <UnidadesPage />
    </AppLayout>
  ),
});

// ─────────────────────────────────────────────────────────────────────────────
// Tipos & utilitários

type Unidade = {
  id: string;
  cod_unidade: string;
  tipo: string;
  nome: string;
  zona: string | null;
  endereco: string | null;
  bairro: string | null;
  tecnicos: string[];
  polo: string | null;
};

const TIPO_TONE: Record<string, { bg: string; text: string; bar: string; ring: string }> = {
  CRECHE:            { bg: "bg-rose-500/10",    text: "text-rose-600 dark:text-rose-400",       bar: "bg-rose-500",    ring: "ring-rose-500/20" },
  EMEI:              { bg: "bg-amber-500/10",   text: "text-amber-600 dark:text-amber-400",     bar: "bg-amber-500",   ring: "ring-amber-500/20" },
  EMEF:              { bg: "bg-sky-500/10",     text: "text-sky-600 dark:text-sky-400",         bar: "bg-sky-500",     ring: "ring-sky-500/20" },
  "EMEF - INTEGRAL": { bg: "bg-indigo-500/10",  text: "text-indigo-600 dark:text-indigo-400",   bar: "bg-indigo-500",  ring: "ring-indigo-500/20" },
  EMEIEF:            { bg: "bg-violet-500/10",  text: "text-violet-600 dark:text-violet-400",   bar: "bg-violet-500",  ring: "ring-violet-500/20" },
  CEMEI:             { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500", ring: "ring-emerald-500/20" },
  CEMEIEF:           { bg: "bg-teal-500/10",    text: "text-teal-600 dark:text-teal-400",       bar: "bg-teal-500",    ring: "ring-teal-500/20" },
  "ESCOLA PARCEIRA": { bg: "bg-cyan-500/10",    text: "text-cyan-600 dark:text-cyan-400",       bar: "bg-cyan-500",    ring: "ring-cyan-500/20" },
  ESPECIAL:          { bg: "bg-fuchsia-500/10", text: "text-fuchsia-600 dark:text-fuchsia-400", bar: "bg-fuchsia-500", ring: "ring-fuchsia-500/20" },
};

const tipoTone = (t: string) =>
  TIPO_TONE[t] ?? { bg: "bg-muted", text: "text-foreground", bar: "bg-muted-foreground", ring: "ring-border" };

const ZONA_TONE: Record<string, string> = {
  SUL:    "bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-sky-500/30",
  NORTE:  "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-indigo-500/30",
  CENTRO: "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/30",
  NI:     "bg-muted text-muted-foreground ring-border",
};

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// ─────────────────────────────────────────────────────────────────────────────
// Página

function UnidadesPage() {
  const [unidades, setUnidades] = React.useState<Unidade[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busca, setBusca] = React.useState("");
  const [tipos, setTipos] = React.useState<string[]>([]);
  const [bairros, setBairros] = React.useState<string[]>([]);
  const [zona, setZona] = React.useState<string>("__all__");
  const [view, setView] = React.useState<"tabela" | "cards">("tabela");
  const [selected, setSelected] = React.useState<Unidade | null>(null);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("unidades_rede" as never)
        .select("*")
        .order("nome", { ascending: true })
        .limit(1000);
      if (error) {
        toast.error("Falha ao carregar unidades", { description: error.message });
      } else {
        setUnidades((data ?? []) as unknown as Unidade[]);
      }
      setLoading(false);
    })();
  }, []);

  const tiposUnicos = React.useMemo(
    () => Array.from(new Set(unidades.map((u) => u.tipo))).sort(),
    [unidades],
  );
  const bairrosUnicos = React.useMemo(
    () =>
      Array.from(new Set(unidades.map((u) => u.bairro ?? "").filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [unidades],
  );
  const zonasUnicas = React.useMemo(
    () => Array.from(new Set(unidades.map((u) => u.zona ?? "").filter(Boolean))).sort(),
    [unidades],
  );

  // Filtragem
  const filtradas = React.useMemo(() => {
    const q = norm(busca.trim());
    return unidades.filter((u) => {
      if (tipos.length && !tipos.includes(u.tipo)) return false;
      if (bairros.length && !bairros.includes(u.bairro ?? "")) return false;
      if (zona !== "__all__" && (u.zona ?? "") !== zona) return false;
      if (!q) return true;
      const hay = norm(`${u.nome} ${u.cod_unidade} ${u.endereco ?? ""} ${u.bairro ?? ""}`);
      return hay.includes(q);
    });
  }, [unidades, busca, tipos, bairros, zona]);

  // Totalizadores (ESPECIAL não conta no geral)
  const isEspecial = (t: string) => t === "ESPECIAL";
  const escolasDataset = unidades.filter((u) => !isEspecial(u.tipo));
  const totalEscolas = escolasDataset.length;
  const totalDepartamentos = unidades.filter((u) => isEspecial(u.tipo)).length;
  const porZonaGeral = React.useMemo(() => {
    const m: Record<string, number> = { SUL: 0, NORTE: 0, CENTRO: 0 };
    escolasDataset.forEach((u) => {
      const z = u.zona ?? "NI";
      m[z] = (m[z] ?? 0) + 1;
    });
    return m;
  }, [escolasDataset]);
  const totalBairros = new Set(escolasDataset.map((u) => u.bairro).filter(Boolean)).size;

  const totaisPorTipo = React.useMemo(() => {
    const m: Record<string, number> = {};
    unidades.forEach((u) => { m[u.tipo] = (m[u.tipo] ?? 0) + 1; });
    return Object.entries(m)
      .map(([tipo, count]) => ({ tipo, count }))
      .sort((a, b) => b.count - a.count);
  }, [unidades]);

  // Totais "respeitando filtros" (para exibir junto à lista)
  const visiveisGeral = filtradas.filter((u) => !isEspecial(u.tipo)).length;
  const visiveisDept = filtradas.filter((u) => isEspecial(u.tipo)).length;

  const limparFiltros = () => {
    setBusca(""); setTipos([]); setBairros([]); setZona("__all__");
  };
  const hasFiltros = busca || tipos.length || bairros.length || zona !== "__all__";

  // Exportação
  const exportarCSV = () => {
    const rows = filtradas.map((u) => ({
      Código: u.cod_unidade, Tipo: u.tipo, Unidade: u.nome,
      Zona: u.zona ?? "", Bairro: u.bairro ?? "", Endereço: u.endereco ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    triggerDownload(blob, `unidades-rede-${stamp()}.csv`);
    toast.success(`Exportado ${rows.length} unidade(s) em CSV`);
  };

  const exportarXLSX = () => {
    const wb = XLSX.utils.book_new();

    const rows = filtradas.map((u) => ({
      Código: u.cod_unidade, Tipo: u.tipo, Unidade: u.nome,
      Zona: u.zona ?? "", Bairro: u.bairro ?? "", Endereço: u.endereco ?? "",
    }));
    const wsList = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, wsList, "Unidades");

    // Resumo
    const resumo: Array<Record<string, string | number>> = [
      { Indicador: "Total de escolas (sem ESPECIAL)", Valor: filtradas.filter((u) => !isEspecial(u.tipo)).length },
      { Indicador: "Departamentos (ESPECIAL)",         Valor: filtradas.filter((u) =>  isEspecial(u.tipo)).length },
      { Indicador: "Bairros distintos",                Valor: new Set(filtradas.map((u) => u.bairro).filter(Boolean)).size },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), "Resumo");

    // Por tipo
    const tipoCount: Record<string, number> = {};
    filtradas.forEach((u) => { tipoCount[u.tipo] = (tipoCount[u.tipo] ?? 0) + 1; });
    const porTipo = Object.entries(tipoCount)
      .sort((a, b) => b[1] - a[1])
      .map(([Tipo, Quantidade]) => ({ Tipo, Quantidade }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porTipo), "Por Tipo");

    // Por zona
    const zonaCount: Record<string, number> = {};
    filtradas.forEach((u) => { const k = u.zona ?? "—"; zonaCount[k] = (zonaCount[k] ?? 0) + 1; });
    const porZona = Object.entries(zonaCount)
      .sort((a, b) => b[1] - a[1])
      .map(([Zona, Quantidade]) => ({ Zona, Quantidade }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porZona), "Por Zona");

    // Por bairro
    const bairroCount: Record<string, number> = {};
    filtradas.forEach((u) => { const k = u.bairro ?? "—"; bairroCount[k] = (bairroCount[k] ?? 0) + 1; });
    const porBairro = Object.entries(bairroCount)
      .sort((a, b) => b[1] - a[1])
      .map(([Bairro, Quantidade]) => ({ Bairro, Quantidade }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porBairro), "Por Bairro");

    XLSX.writeFile(wb, `unidades-rede-${stamp()}.xlsx`);
    toast.success(`Relatório XLSX gerado com ${rows.length} unidade(s)`);
  };

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Rede Municipal de Osasco"
        title="Unidades da Rede"
        description="Cadastro completo das unidades escolares e departamentos da Secretaria de Educação."
        icon={Building2}
        tone="indigo"
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Exportar relatório
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Respeita filtros aplicados
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={exportarXLSX} className="gap-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                Excel (.xlsx) com totalizadores
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportarCSV} className="gap-2">
                <FileText className="h-4 w-4 text-sky-500" />
                CSV simples
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
        stats={[
          { icon: School,    label: "Escolas",        value: loading ? "—" : totalEscolas,       tone: "emerald", hint: "ESPECIAL não conta" },
          { icon: Compass,   label: "Zona Sul",       value: loading ? "—" : porZonaGeral.SUL ?? 0,    tone: "sky" },
          { icon: Compass,   label: "Zona Norte",     value: loading ? "—" : porZonaGeral.NORTE ?? 0,  tone: "indigo" },
          { icon: Compass,   label: "Centro",         value: loading ? "—" : porZonaGeral.CENTRO ?? 0, tone: "amber" },
          { icon: MapPin,    label: "Bairros",        value: loading ? "—" : totalBairros,             tone: "violet" },
          { icon: Briefcase, label: "Departamentos",  value: loading ? "—" : totalDepartamentos,       tone: "rose", hint: "Tipo ESPECIAL" },
        ]}
      />

      {/* Totalizadores por tipo */}
      <TotalizadoresTipo data={totaisPorTipo} total={unidades.length} loading={loading} />

      {/* Filtros + visualização */}
      <div className="sticky top-0 z-10 -mx-3 rounded-2xl border bg-card/85 px-3 py-3 shadow-sm backdrop-blur-md sm:-mx-4 sm:px-4 lg:-mx-6 lg:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, código, endereço…"
                className="pl-9"
              />
            </div>

            <MultiSelectCombobox
              label="Tipo"
              icon={Layers}
              options={tiposUnicos}
              values={tipos}
              onChange={setTipos}
            />
            <MultiSelectCombobox
              label="Bairro"
              icon={MapPin}
              options={bairrosUnicos}
              values={bairros}
              onChange={setBairros}
            />
            <ZonaSelect zonas={zonasUnicas} value={zona} onChange={setZona} />

            {hasFiltros && (
              <Button variant="ghost" size="sm" onClick={limparFiltros} className="gap-1">
                <X className="h-3.5 w-3.5" /> Limpar
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 px-2.5 py-1 font-normal">
              <Filter className="h-3 w-3" />
              <span className="tabular-nums">{filtradas.length}</span>
              <span className="text-muted-foreground">de {unidades.length}</span>
            </Badge>
            <Tabs value={view} onValueChange={(v) => setView(v as "tabela" | "cards")}>
              <TabsList className="h-8">
                <TabsTrigger value="tabela" className="h-6 gap-1 px-2 text-xs">
                  <List className="h-3.5 w-3.5" /> Tabela
                </TabsTrigger>
                <TabsTrigger value="cards" className="h-6 gap-1 px-2 text-xs">
                  <LayoutGrid className="h-3.5 w-3.5" /> Cards
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {(tipos.length > 0 || bairros.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tipos.map((t) => (
              <Chip key={`t-${t}`} onRemove={() => setTipos(tipos.filter((x) => x !== t))}>
                <Layers className="h-3 w-3" /> {t}
              </Chip>
            ))}
            {bairros.map((b) => (
              <Chip key={`b-${b}`} onRemove={() => setBairros(bairros.filter((x) => x !== b))}>
                <MapPin className="h-3 w-3" /> {b}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {/* Resumo da seleção atual */}
      {!loading && hasFiltros && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>
            Mostrando{" "}
            <strong className="tabular-nums text-foreground">{visiveisGeral}</strong> escolas
            {visiveisDept > 0 && (
              <>
                {" "}
                e <strong className="tabular-nums text-foreground">{visiveisDept}</strong>{" "}
                departamento{visiveisDept > 1 ? "s" : ""}
              </>
            )}{" "}
            no recorte atual.
          </span>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <ListaSkeleton />
      ) : filtradas.length === 0 ? (
        <EmptyResultado onLimpar={limparFiltros} hasFiltros={Boolean(hasFiltros)} />
      ) : view === "tabela" ? (
        <UnidadesTabela data={filtradas} onSelect={setSelected} />
      ) : (
        <UnidadesCards data={filtradas} onSelect={setSelected} />
      )}

      <UnidadeDrawer unidade={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponentes

function TotalizadoresTipo({
  data, total, loading,
}: {
  data: Array<{ tipo: string; count: number }>;
  total: number;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }
  return (
    <div className="rounded-2xl border bg-card/60 p-3 backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <Layers className="h-3.5 w-3.5" /> Totalizadores por tipo
        </h2>
        <span className="text-[10.5px] text-muted-foreground/80">
          ESPECIAL exibido separadamente — não soma ao geral
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
        {data.map(({ tipo, count }) => {
          const t = tipoTone(tipo);
          const pct = total ? Math.round((count / total) * 100) : 0;
          const isEsp = tipo === "ESPECIAL";
          return (
            <div
              key={tipo}
              className={cn(
                "group relative overflow-hidden rounded-xl border bg-background p-2.5 ring-1 transition-all hover:-translate-y-0.5 hover:shadow-md",
                t.ring,
              )}
            >
              <div className={cn("absolute left-0 top-0 h-full w-1", t.bar)} />
              <div className="pl-1.5">
                <div className="flex items-center justify-between gap-1">
                  <span className={cn("text-[10px] font-semibold uppercase tracking-wider", t.text)}>
                    {tipo}
                  </span>
                  {isEsp && (
                    <Badge variant="outline" className="h-4 border-fuchsia-500/40 bg-fuchsia-500/10 px-1 text-[8.5px] font-medium text-fuchsia-600 dark:text-fuchsia-400">
                      dept.
                    </Badge>
                  )}
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-xl font-bold tabular-nums">{count}</span>
                  <span className="text-[10px] text-muted-foreground">/ {pct}%</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full transition-all", t.bar)} style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MultiSelectCombobox({
  label, icon: Icon, options, values, onChange,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  options: string[];
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          {label}
          {values.length > 0 && (
            <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px] tabular-nums">
              {values.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput placeholder={`Filtrar ${label.toLowerCase()}…`} />
          <CommandList className="max-h-72">
            <CommandEmpty>Nada encontrado.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const checked = values.includes(opt);
                return (
                  <CommandItem
                    key={opt}
                    onSelect={() => {
                      onChange(checked ? values.filter((v) => v !== opt) : [...values, opt]);
                    }}
                    className="flex items-center gap-2"
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded border",
                        checked ? "border-primary bg-primary text-primary-foreground" : "border-input",
                      )}
                    >
                      {checked && <span className="text-[10px]">✓</span>}
                    </span>
                    <span className="flex-1 truncate text-xs">{opt}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {values.length > 0 && (
            <div className="border-t p-2">
              <Button variant="ghost" size="sm" className="w-full justify-center text-xs" onClick={() => onChange([])}>
                Limpar seleção
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ZonaSelect({
  zonas, value, onChange,
}: { zonas: string[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const label = value === "__all__" ? "Todas as zonas" : value;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5">
          <Compass className="h-3.5 w-3.5 text-muted-foreground" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-1">
        <button
          className={cn(
            "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-accent",
            value === "__all__" && "bg-accent font-medium",
          )}
          onClick={() => { onChange("__all__"); setOpen(false); }}
        >
          Todas as zonas
        </button>
        {zonas.map((z) => (
          <button
            key={z}
            className={cn(
              "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-accent",
              value === z && "bg-accent font-medium",
            )}
            onClick={() => { onChange(z); setOpen(false); }}
          >
            <span>{z}</span>
            <span className={cn("h-2 w-2 rounded-full", (ZONA_TONE[z] ?? "").split(" ").find((x) => x.startsWith("bg-")) ?? "bg-muted-foreground")} />
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px]">
      {children}
      <button
        onClick={onRemove}
        className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Remover filtro"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function UnidadesTabela({
  data, onSelect,
}: { data: Unidade[]; onSelect: (u: Unidade) => void }) {
  const [pagina, setPagina] = React.useState(1);
  const porPagina = 50;
  const totalPag = Math.max(1, Math.ceil(data.length / porPagina));
  React.useEffect(() => { setPagina(1); }, [data]);
  const slice = data.slice((pagina - 1) * porPagina, pagina * porPagina);

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-left">Código</th>
              <th className="px-3 py-2.5 text-left">Tipo</th>
              <th className="px-3 py-2.5 text-left">Unidade</th>
              <th className="hidden px-3 py-2.5 text-left md:table-cell">Zona</th>
              <th className="hidden px-3 py-2.5 text-left lg:table-cell">Bairro</th>
              <th className="hidden px-3 py-2.5 text-left xl:table-cell">Endereço</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {slice.map((u) => {
              const t = tipoTone(u.tipo);
              return (
                <tr
                  key={u.id}
                  onClick={() => onSelect(u)}
                  className="group cursor-pointer transition-colors hover:bg-muted/40"
                >
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                      <Hash className="h-3 w-3" />
                      {u.cod_unidade}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ring-1", t.bg, t.text, t.ring)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", t.bar)} />
                      {u.tipo}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-foreground">{u.nome}</div>
                  </td>
                  <td className="hidden px-3 py-2.5 md:table-cell">
                    {u.zona && (
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1", ZONA_TONE[u.zona] ?? ZONA_TONE.NI)}>
                        {u.zona}
                      </span>
                    )}
                  </td>
                  <td className="hidden px-3 py-2.5 text-xs text-muted-foreground lg:table-cell">{u.bairro}</td>
                  <td className="hidden max-w-md truncate px-3 py-2.5 text-xs text-muted-foreground xl:table-cell">{u.endereco}</td>
                  <td className="pr-3 text-muted-foreground/50 group-hover:text-foreground">
                    <ChevronRight className="h-4 w-4" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPag > 1 && (
        <div className="flex items-center justify-between border-t bg-muted/30 px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            Página <strong className="tabular-nums">{pagina}</strong> de <strong className="tabular-nums">{totalPag}</strong>
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={pagina === totalPag} onClick={() => setPagina(pagina + 1)}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function UnidadesCards({
  data, onSelect,
}: { data: Unidade[]; onSelect: (u: Unidade) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.map((u) => {
        const t = tipoTone(u.tipo);
        return (
          <button
            key={u.id}
            onClick={() => onSelect(u)}
            className={cn(
              "group relative overflow-hidden rounded-xl border bg-card p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
              "ring-1",
              t.ring,
            )}
          >
            <div className={cn("absolute left-0 top-0 h-full w-1.5", t.bar)} />
            <div className="pl-1.5">
              <div className="flex items-start justify-between gap-2">
                <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1", t.bg, t.text, t.ring)}>
                  {u.tipo}
                </span>
                <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                  #{u.cod_unidade}
                </span>
              </div>
              <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-foreground">{u.nome}</h3>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{u.bairro ?? "—"}</span>
                {u.zona && (
                  <>
                    <span className="text-muted-foreground/40">•</span>
                    <span className="uppercase">{u.zona}</span>
                  </>
                )}
              </div>
              {u.endereco && (
                <p className="mt-1 line-clamp-2 text-[10.5px] text-muted-foreground/80">{u.endereco}</p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function UnidadeDrawer({
  unidade, onOpenChange,
}: { unidade: Unidade | null; onOpenChange: (open: boolean) => void }) {
  if (!unidade) return null;
  const t = tipoTone(unidade.tipo);
  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="text-left">
          <div className={cn("inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ring-1", t.bg, t.text, t.ring)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", t.bar)} />
            {unidade.tipo}
          </div>
          <SheetTitle className="text-xl">{unidade.nome}</SheetTitle>
          <SheetDescription className="flex items-center gap-1.5 text-xs">
            <Hash className="h-3 w-3" /> Código {unidade.cod_unidade}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <InfoRow icon={Compass} label="Zona" value={unidade.zona ?? "—"} />
          <InfoRow icon={MapIcon} label="Bairro" value={unidade.bairro ?? "—"} />
          <InfoRow icon={MapPin}  label="Endereço" value={unidade.endereco ?? "—"} multiline />

          <div className="rounded-xl border border-dashed border-violet-500/30 bg-violet-500/[0.04] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
              <Users2 className="h-3.5 w-3.5" />
              Técnicos atendentes
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Disponível em breve — permitirá vincular técnicos de TI a cada unidade escolar.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({
  icon: Icon, label, value, multiline,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; multiline?: boolean }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card/40 p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={cn("mt-0.5 text-sm text-foreground", !multiline && "truncate")}>{value}</div>
      </div>
    </div>
  );
}

function ListaSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
    </div>
  );
}

function EmptyResultado({ onLimpar, hasFiltros }: { onLimpar: () => void; hasFiltros: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-card/40 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Search className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold">Nenhuma unidade encontrada</h3>
      <p className="max-w-sm text-xs text-muted-foreground">
        {hasFiltros
          ? "Tente ajustar os filtros ou limpar a busca para ver outros resultados."
          : "Ainda não há unidades cadastradas na rede."}
      </p>
      {hasFiltros && <Button size="sm" variant="outline" onClick={onLimpar}>Limpar filtros</Button>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers

function stamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// referenced to keep tree-shake-happy import (Loader2 used by AppLayout indirectly)
void Loader2;
