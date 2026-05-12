import { createFileRoute } from "@tanstack/react-router";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  startOfWeek,
  endOfWeek,
  addDays,
  format,
  isSameDay,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  addWeeks,
  subWeeks,
  isSameMonth,
  differenceInCalendarDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  CalendarRange,
  Plus,
  CheckSquare,
  Inbox,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PanelCard } from "@/components/StatCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { qk } from "@/lib/queries/keys";
import { isAtribuidoA } from "@/lib/domain/atividades";
import { PreviewDialog, type PreviewItem } from "@/components/PreviewDialog";
import { agruparColaboradoresPorEquipe } from "@/lib/equipes";
import { NovaTarefaDialog } from "@/components/tarefas/NovaTarefaDialog";
import { DemandaDialog } from "@/components/demandas/DemandaDialog";

export const Route = createFileRoute("/atividades")({
  errorComponent: RouteErrorBoundary,
  component: AtividadesRoute,
});

function AtividadesRoute() {
  return (
    <AppLayout>
      <Atividades />
    </AppLayout>
  );
}

type Periodo = "semana" | "mes";

type Atividade = {
  id: string;
  rawId: string;
  tipo: "tarefa" | "demanda" | "reuniao";
  titulo: string;
  data: Date;
  prioridade?: string | null;
  responsavel?: string | null;
  descricao?: string | null;
  status?: string | null;
  tags?: string[] | null;
};

const tipoColor: Record<string, string> = {
  tarefa: "bg-info/15 text-info border-info/30",
  demanda: "bg-warning/20 text-warning border-warning/40",
  reuniao: "bg-primary/15 text-primary border-primary/30",
};

/** Faz parse de "YYYY-MM-DD" como data local, evitando shift de fuso. */
function parseLocalDate(str: string | null | undefined): Date | null {
  if (!str) return null;
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function Atividades() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [periodo, setPeriodo] = React.useState<Periodo>("semana");
  const [cursor, setCursor] = React.useState(new Date());
  const [tipoFiltro, setTipoFiltro] = React.useState<string>("todos");
  const [escopo, setEscopo] = React.useState<string>("equipe");
  const [preview, setPreview] = React.useState<PreviewItem | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  // Criação rápida
  const [novaTarefaOpen, setNovaTarefaOpen] = React.useState(false);
  const [novaDemandaOpen, setNovaDemandaOpen] = React.useState(false);
  const [defaultData, setDefaultData] = React.useState<string | undefined>(undefined);

  const abrirNovaTarefa = (data?: Date) => {
    setDefaultData(data ? format(data, "yyyy-MM-dd") : undefined);
    setNovaTarefaOpen(true);
  };
  const abrirNovaDemanda = (data?: Date) => {
    setDefaultData(data ? format(data, "yyyy-MM-dd") : undefined);
    setNovaDemandaOpen(true);
  };

  const abrirDetalhe = React.useCallback((a: Atividade) => {
    setPreview({
      id: a.rawId,
      tipo: a.tipo,
      titulo: a.titulo,
      descricao: a.descricao ?? null,
      status: a.status ?? null,
      prioridade: a.prioridade ?? null,
      responsavel: a.responsavel ?? null,
      data: a.data,
      dataLabel: a.tipo === "reuniao" ? "Quando" : "Prazo",
      tags: a.tags ?? null,
    });
    setPreviewOpen(true);
  }, []);

  const inicio = React.useMemo(
    () =>
      startOfDay(
        periodo === "semana"
          ? startOfWeek(cursor, { weekStartsOn: 1 })
          : startOfMonth(cursor),
      ),
    [cursor, periodo],
  );
  const fim = React.useMemo(
    () =>
      endOfDay(
        periodo === "semana"
          ? endOfWeek(cursor, { weekStartsOn: 1 })
          : endOfMonth(cursor),
      ),
    [cursor, periodo],
  );

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["atv-colaboradores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaborador")
        .select("id, nome, cargo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const colabsAgrupados = React.useMemo(
    () => agruparColaboradoresPorEquipe(colaboradores),
    [colaboradores],
  );

  const { data: meuProfile } = useQuery({
    queryKey: ["atv-meu-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("colaborador_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const meuColabId = meuProfile?.colaborador_id ?? null;

  const { data: tarefas = [] } = useQuery({
    queryKey: qk.atividades.tarefas(),
    queryFn: async () => {
      const { data, error } = await supabase.from("todo").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: demandas = [] } = useQuery({
    queryKey: qk.atividades.demandas(),
    queryFn: async () => {
      const { data, error } = await supabase.from("demanda").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: reunioes = [] } = useQuery({
    queryKey: qk.atividades.reunioes(),
    queryFn: async () => {
      const { data, error } = await supabase.from("reuniao").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Lista mínima de demandas para o select da nova tarefa
  const demandasMini = React.useMemo(
    () => (demandas as Array<{ id: string; titulo: string }>).map((d) => ({ id: d.id, titulo: d.titulo })),
    [demandas],
  );

  const isMine = React.useCallback(
    (r: any) => isAtribuidoA(r, meuColabId),
    [meuColabId],
  );

  const colabById = React.useMemo(() => {
    const m = new Map<string, string>();
    colaboradores.forEach((c) => m.set(c.id, c.nome));
    return m;
  }, [colaboradores]);

  const todas: Atividade[] = React.useMemo(() => {
    const arr: Atividade[] = [];
    const tarefaConcluida = ["concluida", "producao", "cancelada", "reprovada"];
    const demandaConcluida = ["concluida", "cancelada"];
    const filtroEscopo = (r: any) => {
      if (escopo === "equipe") return true;
      if (escopo === "minhas") return isMine(r);
      return isAtribuidoA(r, escopo);
    };
    tarefas.filter(filtroEscopo).forEach((t: any) => {
      const d = parseLocalDate(t.data_prevista);
      if (d && !tarefaConcluida.includes(t.status))
        arr.push({
          id: `t-${t.id}`,
          rawId: t.id,
          tipo: "tarefa",
          titulo: t.titulo,
          data: d,
          prioridade: t.prioridade,
          status: t.status,
          descricao: t.descricao,
          responsavel: t.responsavel_id ? colabById.get(t.responsavel_id) ?? null : null,
        });
    });
    demandas.filter(filtroEscopo).forEach((d: any) => {
      const dt = parseLocalDate(d.prazo);
      if (dt && !demandaConcluida.includes(d.status))
        arr.push({
          id: `d-${d.id}`,
          rawId: d.id,
          tipo: "demanda",
          titulo: d.titulo,
          data: dt,
          prioridade: d.prioridade,
          status: d.status,
          descricao: d.descricao,
          tags: d.tags,
          responsavel: d.responsavel_id ? colabById.get(d.responsavel_id) ?? null : null,
        });
    });
    reunioes.filter(filtroEscopo).forEach((r: any) => {
      if (r.status !== "cancelada")
        arr.push({
          id: `r-${r.id}`,
          rawId: r.id,
          tipo: "reuniao",
          titulo: r.titulo,
          data: new Date(r.data_reuniao),
          status: r.status,
          descricao: r.pauta,
          responsavel: r.responsavel_id ? colabById.get(r.responsavel_id) ?? null : null,
        });
    });
    return arr;
  }, [tarefas, demandas, reunioes, escopo, isMine, colabById]);

  const noPeriodo = todas.filter(
    (a) =>
      a.data >= inicio &&
      a.data <= fim &&
      (tipoFiltro === "todos" || a.tipo === tipoFiltro),
  );

  const navPrev = () =>
    setCursor(
      periodo === "semana"
        ? subWeeks(cursor, 1)
        : new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1),
    );
  const navNext = () =>
    setCursor(
      periodo === "semana"
        ? addWeeks(cursor, 1)
        : new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1),
    );
  const hoje = () => setCursor(new Date());

  // ────── Grades ──────
  // Semana: 7 dias começando segunda
  const diasSemana = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(inicio, i)),
    [inicio],
  );

  // Mês: alinhado a Seg–Dom, do início da semana do dia 1 até o fim da semana do último dia.
  const diasMes = React.useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    const total = differenceInCalendarDays(gridEnd, gridStart) + 1;
    return Array.from({ length: total }, (_, i) => addDays(gridStart, i));
  }, [cursor]);

  const onCriado = () => {
    qc.invalidateQueries({ queryKey: qk.atividades.tarefas() });
    qc.invalidateQueries({ queryKey: qk.atividades.demandas() });
  };

  const novoMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Novo
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => abrirNovaTarefa()}>
          <CheckSquare className="mr-2 h-4 w-4" /> Nova tarefa
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => abrirNovaDemanda()}>
          <Inbox className="mr-2 h-4 w-4" /> Nova demanda
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const QuickAdd = ({ data }: { data: Date }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Adicionar neste dia"
          className="opacity-0 group-hover:opacity-100 transition rounded-full p-0.5 hover:bg-primary/10 text-muted-foreground hover:text-primary focus:outline-none focus:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => abrirNovaTarefa(data)}>
          <CheckSquare className="mr-2 h-4 w-4" /> Tarefa neste dia
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => abrirNovaDemanda(data)}>
          <Inbox className="mr-2 h-4 w-4" /> Demanda com este prazo
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div>
      <PageHeader
        title="Atividades semanais"
        description="Agenda consolidada — tarefas, demandas e reuniões com prazo no período."
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Colaborador
              </label>
              <Select value={escopo} onValueChange={setEscopo}>
                <SelectTrigger className="w-44 sm:w-52"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-96">
                  <SelectItem value="equipe">Toda a equipe</SelectItem>
                  <SelectItem value="minhas" disabled={!meuColabId}>Minhas atribuições</SelectItem>
                  {colabsAgrupados.grupos.map((g) =>
                    g.items.length > 0 ? (
                      <div key={g.label}>
                        <div className="my-1 border-t border-border" />
                        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {g.label}
                        </div>
                        {g.items.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </div>
                    ) : null,
                  )}
                  {colabsAgrupados.outros.length > 0 && (
                    <div>
                      <div className="my-1 border-t border-border" />
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Outros
                      </div>
                      {colabsAgrupados.outros.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Tipo
              </label>
              <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                <SelectTrigger className="w-32 sm:w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="tarefa">Tarefas</SelectItem>
                  <SelectItem value="demanda">Demandas</SelectItem>
                  <SelectItem value="reuniao">Reuniões</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Período
              </label>
              <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
                <SelectTrigger className="w-28 sm:w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semana">Semana</SelectItem>
                  <SelectItem value="mes">Mês</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 justify-end">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-transparent select-none">.</span>
              {novoMenu}
            </div>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={navPrev}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" onClick={hoje}>Hoje</Button>
          <Button variant="outline" size="icon" onClick={navNext}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium sm:text-sm">
          <CalendarRange className="h-4 w-4 text-muted-foreground" />
          <span className="hidden sm:inline">{format(inicio, "dd 'de' MMMM", { locale: ptBR })} – {format(fim, "dd 'de' MMMM yyyy", { locale: ptBR })}</span>
          <span className="sm:hidden">{format(inicio, "dd/MM", { locale: ptBR })} – {format(fim, "dd/MM/yy", { locale: ptBR })}</span>
        </div>
      </div>

      {periodo === "semana" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {diasSemana.map((dia) => {
            const doDia = noPeriodo.filter((a) => isSameDay(a.data, dia));
            const isHoje = isSameDay(dia, new Date());
            return (
              <PanelCard
                key={dia.toISOString()}
                title={
                  <div className="flex items-center justify-between gap-2 group">
                    <span>{format(dia, "EEE dd/MM", { locale: ptBR })}</span>
                    <QuickAdd data={dia} />
                  </div> as unknown as string
                }
                className={isHoje ? "ring-2 ring-primary/40 group" : "group"}
              >
                <div className="min-h-[140px] space-y-2 sm:min-h-[180px]">
                  {doDia.length === 0 ? (
                    <p className="text-xs text-muted-foreground">—</p>
                  ) : (
                    doDia.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => abrirDetalhe(a)}
                        className={`w-full text-left rounded-md border p-2 text-xs transition hover:brightness-110 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 ${tipoColor[a.tipo]}`}
                      >
                        <Badge variant="outline" className="mb-1 text-[9px] uppercase">{a.tipo}</Badge>
                        <p className="font-medium leading-tight">{a.titulo}</p>
                        {a.tipo === "reuniao" && (
                          <p className="mt-0.5 text-[10px] opacity-80">{format(a.data, "HH:mm")}</p>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </PanelCard>
            );
          })}
        </div>
      ) : (
        <PanelCard title={format(cursor, "MMMM yyyy", { locale: ptBR })}>
          <div className="-mx-2 overflow-x-auto px-2">
            <div className="grid min-w-[640px] grid-cols-7 gap-2">
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
                <div key={d} className="px-2 py-1 text-center text-[10px] font-semibold uppercase text-muted-foreground">
                  {d}
                </div>
              ))}
              {diasMes.map((dia) => {
                const doDia = noPeriodo.filter((a) => isSameDay(a.data, dia));
                const isHoje = isSameDay(dia, new Date());
                const noMes = isSameMonth(dia, cursor);
                const dow = dia.getDay(); // 0=dom, 6=sab
                const isWeekend = dow === 0 || dow === 6;
                return (
                  <div
                    key={dia.toISOString()}
                    className={`group min-h-[100px] rounded-md border p-1.5 text-xs transition ${
                      isHoje
                        ? "border-primary bg-primary/5"
                        : noMes
                        ? isWeekend
                          ? "border-border bg-muted/30"
                          : "border-border"
                        : "border-border/50 bg-muted/10 opacity-60"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className={`text-[10px] font-semibold ${noMes ? "" : "text-muted-foreground"}`}>
                        {format(dia, "dd")}
                      </span>
                      <div className="flex items-center gap-1">
                        {doDia.length > 0 && (
                          <span className="text-[9px] text-muted-foreground">{doDia.length}</span>
                        )}
                        {noMes && <QuickAdd data={dia} />}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {doDia.slice(0, 3).map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => abrirDetalhe(a)}
                          className={`block w-full truncate text-left rounded px-1 py-0.5 text-[10px] transition hover:brightness-110 ${tipoColor[a.tipo]}`}
                        >
                          {a.titulo}
                        </button>
                      ))}
                      {doDia.length > 3 && (
                        <p className="text-[10px] text-muted-foreground">+{doDia.length - 3}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </PanelCard>
      )}

      <div className="mt-6 flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-info" /> Tarefa</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-warning" /> Demanda</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Reunião</span>
      </div>

      <PreviewDialog item={preview} open={previewOpen} onOpenChange={setPreviewOpen} />

      {/* Dialogs de criação rápida */}
      <NovaTarefaDialog
        colabs={colaboradores as any}
        demandas={demandasMini}
        open={novaTarefaOpen}
        onOpenChange={setNovaTarefaOpen}
        defaultData={defaultData}
        hideTrigger
      />
      <DemandaDialog
        open={novaDemandaOpen}
        onOpenChange={setNovaDemandaOpen}
        colabs={colaboradores as any}
        userId={user?.id}
        initial={
          defaultData
            ? {
                titulo: "",
                descricao: "",
                origem: "email",
                categoria: "melhoria",
                prioridade: "media",
                solicitante: "",
                responsaveis_ids: [],
                equipe_toda: false,
                prazo: defaultData,
                tags: [],
              }
            : null
        }
        onSaved={onCriado}
      />
    </div>
  );
}
