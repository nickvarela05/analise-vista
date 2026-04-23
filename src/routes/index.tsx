import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import {
  AlertTriangle,
  FileBarChart,
  Megaphone,
  Calendar,
  CheckSquare,
  Plane,
  Users,
  Clock,
  ArrowRight,
  CalendarRange,
  Inbox,
} from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { KpiTile, Panel } from "@/components/KpiTile";
import { PreviewDialog, type PreviewItem } from "@/components/PreviewDialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export const Route = createFileRoute("/")({
  component: IndexRoute,
});

function IndexRoute() {
  return (
    <AppLayout>
      <Dashboard />
    </AppLayout>
  );
}

function Dashboard() {
  const [preview, setPreview] = React.useState<PreviewItem | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  const openPreview = (item: PreviewItem) => {
    setPreview(item);
    setPreviewOpen(true);
  };

  const { data: chamados = [], isLoading: loadingChamados } = useQuery({
    queryKey: ["dash-chamados"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chamado_externo").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: tarefas = [], isLoading: loadingTarefas } = useQuery({
    queryKey: ["dash-tarefas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("todo").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: reunioes = [], isLoading: loadingReunioes } = useQuery({
    queryKey: ["dash-reunioes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reuniao")
        .select("*")
        .order("data_reuniao");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: avisos = [], isLoading: loadingAvisos } = useQuery({
    queryKey: ["dash-avisos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aviso_gestor")
        .select("*")
        .eq("ativo", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: ferias = [] } = useQuery({
    queryKey: ["dash-ferias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaborador_ferias")
        .select("*, colaborador(nome, foto_url)")
        .order("data_inicio", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["dash-colaboradores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaborador")
        .select("*, colaborador_horario(*)")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: demandas = [] } = useQuery({
    queryKey: ["dash-demandas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("demanda").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const colabById = React.useMemo(() => {
    const map = new Map<string, any>();
    colaboradores.forEach((c) => map.set(c.id, c));
    return map;
  }, [colaboradores]);

  // KPIs
  const totalChamados = chamados.length;
  const relatPendentes = chamados.filter((c) => c.status !== "finalizado").length;
  const relatEncaminhados = chamados.filter((c) => c.status === "encaminhado").length;

  const tarefasAtivas = tarefas.filter(
    (t) => !["concluida", "producao", "reprovada", "cancelada"].includes(t.status),
  );
  const taskAbertas = tarefasAtivas.length;
  const taskHML = tarefas.filter((t) => t.status === "homologacao").length;
  const taskProd = tarefas.filter((t) => t.status === "producao").length;
  const taskUrgentes = tarefasAtivas.filter((t) => t.prioridade === "alta").length;

  const now = new Date();
  const avisosCrit = avisos.filter(
    (a) => a.tipo === "critico" && (!a.expira_em || new Date(a.expira_em).getTime() > now.getTime()),
  ).length;

  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const reunioesSemana = reunioes.filter(
    (r) =>
      r.status !== "cancelada" &&
      isWithinInterval(new Date(r.data_reuniao), { start: weekStart, end: weekEnd }),
  ).length;

  const feriasAtivas = ferias.filter((f: any) => {
    const inicio = new Date(f.data_inicio);
    const fim = new Date(f.data_fim);
    return inicio <= now && fim >= now;
  }).length;

  // Pie de status de tarefas
  const pieTarefas = [
    {
      name: "Aberta",
      value: tarefas.filter((t) => ["aberta", "pendente"].includes(t.status)).length,
      color: "var(--chart-3)",
    },
    {
      name: "Em andamento",
      value: tarefas.filter((t) => t.status === "em_andamento").length,
      color: "var(--chart-5)",
    },
    {
      name: "Encaminhada",
      value: tarefas.filter((t) => t.status === "encaminhada").length,
      color: "var(--chart-4)",
    },
    { name: "Homologação", value: taskHML, color: "var(--chart-4)" },
    { name: "Produção", value: taskProd, color: "var(--chart-2)" },
    {
      name: "Concluída",
      value: tarefas.filter((t) => t.status === "concluida").length,
      color: "var(--chart-1)",
    },
  ].filter((d) => d.value > 0);

  // Atribuições por colaborador (gráfico) — considera responsaveis_ids + equipe_toda
  const totalColabsAtivos = colaboradores.length;
  const countAssignees = (rows: any[], colabId: string) =>
    rows.filter((r) => {
      if (r.equipe_toda) return true;
      const ids: string[] = r.responsaveis_ids ?? [];
      if (ids.length > 0) return ids.includes(colabId);
      // fallback para registros antigos com responsavel_id único
      return r.responsavel_id === colabId;
    }).length;

  const atribuicoes = colaboradores.map((c) => {
    const tDoColab = countAssignees(tarefas, c.id);
    const dDoColab = countAssignees(demandas, c.id);
    const rDoColab = countAssignees(reunioes, c.id);
    const relDoColab = countAssignees(chamados, c.id);
    return {
      nome: c.nome.split(" ")[0],
      Tarefas: tDoColab,
      Demandas: dDoColab,
      Reuniões: rDoColab,
      Relatórios: relDoColab,
      Total: tDoColab + dDoColab + rDoColab + relDoColab,
    };
  });

  // Atividades semanais consolidadas
  type Atividade = PreviewItem & { _sortDate: number };
  const atividades: Atividade[] = [];

  tarefas.forEach((t) => {
    if (t.data_prevista) {
      const d = new Date(t.data_prevista);
      if (isWithinInterval(d, { start: weekStart, end: weekEnd })) {
        atividades.push({
          id: t.id,
          tipo: "tarefa",
          titulo: t.titulo,
          descricao: t.descricao,
          status: t.status,
          prioridade: t.prioridade,
          responsavel: t.responsavel_id ? colabById.get(t.responsavel_id)?.nome : null,
          data: d,
          dataLabel: "Prazo",
          _sortDate: d.getTime(),
        });
      }
    }
  });
  demandas.forEach((d) => {
    if (d.prazo) {
      const dt = new Date(d.prazo);
      if (isWithinInterval(dt, { start: weekStart, end: weekEnd })) {
        atividades.push({
          id: d.id,
          tipo: "demanda",
          titulo: d.titulo,
          descricao: d.descricao,
          status: d.status,
          prioridade: d.prioridade,
          responsavel: d.responsavel_id ? colabById.get(d.responsavel_id)?.nome : null,
          data: dt,
          dataLabel: "Prazo",
          tags: d.tags,
          _sortDate: dt.getTime(),
        });
      }
    }
  });
  reunioes.forEach((r) => {
    const dt = new Date(r.data_reuniao);
    if (isWithinInterval(dt, { start: weekStart, end: weekEnd })) {
      atividades.push({
        id: r.id,
        tipo: "reuniao",
        titulo: r.titulo,
        descricao: r.pauta,
        status: r.status,
        responsavel: r.responsavel_id ? colabById.get(r.responsavel_id)?.nome : null,
        data: dt,
        dataLabel: "Quando",
        _sortDate: dt.getTime(),
      });
    }
  });
  atividades.sort((a, b) => a._sortDate - b._sortDate);

  const proximasFerias = ferias.slice(0, 4);

  const horarios = colaboradores
    .map((c) => {
      const seg = (c.colaborador_horario ?? []).find((h: any) => h.dia_semana === 1);
      if (!seg) return null;
      return {
        nome: c.nome.split(" ")[0],
        foto: c.foto_url,
        expediente: `${seg.expediente_inicio?.slice(0, 5) ?? "—"} – ${seg.expediente_fim?.slice(0, 5) ?? "—"}`,
        almoco: seg.almoco_inicio
          ? `${seg.almoco_inicio.slice(0, 5)} – ${seg.almoco_fim?.slice(0, 5)}`
          : "—",
        local: seg.local_almoco ?? "—",
      };
    })
    .filter(Boolean) as {
    nome: string;
    foto: string | null;
    expediente: string;
    almoco: string;
    local: string;
  }[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Painel gerencial"
        description="Visão consolidada da equipe de Análise de Requisitos."
      />

      {/* Avisos críticos */}
      {avisos.length > 0 && (
        <div className="space-y-2">
          {avisos.slice(0, 2).map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() =>
                openPreview({
                  id: a.id,
                  tipo: "aviso",
                  titulo: a.titulo,
                  descricao: a.mensagem,
                  status: a.tipo,
                  data: a.created_at,
                  dataLabel: "Publicado",
                })
              }
              className={cn(
                "alert-banner w-full text-left",
                a.tipo === "critico"
                  ? "alert-banner-critico"
                  : a.tipo === "alerta"
                    ? "alert-banner-alerta"
                    : "alert-banner-informativo",
              )}
            >
              <AlertTriangle
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  a.tipo === "critico"
                    ? "text-destructive"
                    : a.tipo === "alerta"
                      ? "text-warning"
                      : "text-info",
                )}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">{a.titulo}</p>
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                  {a.mensagem}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] uppercase shrink-0">
                {a.tipo}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {/* KPIs principais */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          icon={FileBarChart}
          label="Chamados em aberto"
          value={relatPendentes}
          hint={`${totalChamados} chamados no total`}
          tone="warning"
          to="/relatorios"
          loading={loadingChamados}
        />
        <KpiTile
          icon={CheckSquare}
          label="Tarefas abertas"
          value={taskAbertas}
          hint={`${taskUrgentes} urgentes`}
          tone="primary"
          to="/tarefas"
          loading={loadingTarefas}
        />
        <KpiTile
          icon={Calendar}
          label="Reuniões nesta semana"
          value={reunioesSemana}
          hint={`${reunioes.length} no total`}
          tone="info"
          to="/reunioes"
          loading={loadingReunioes}
        />
        <KpiTile
          icon={Megaphone}
          label="Avisos críticos"
          value={avisosCrit}
          hint={`${avisos.length} avisos ativos`}
          tone="destructive"
          to="/avisos"
          loading={loadingAvisos}
        />
      </div>

      {/* Linha 2 — Gráficos */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Atribuições por colaborador"
          className="lg:col-span-2"
          actions={
            <Link
              to="/equipe"
              className="text-xs font-medium text-primary hover:underline"
            >
              Ver equipe →
            </Link>
          }
        >
          <div className="h-72">
            {atribuicoes.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Nenhum colaborador cadastrado.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={atribuicoes}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="nome"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    stroke="var(--muted-foreground)"
                  />
                  <YAxis
                    allowDecimals={false}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    stroke="var(--muted-foreground)"
                  />
                  <Tooltip
                    cursor={{ fill: "color-mix(in oklab, var(--primary) 6%, transparent)" }}
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid var(--tooltip-border)",
                      background: "var(--tooltip-bg)",
                      color: "var(--tooltip-foreground)",
                      fontSize: 12,
                      boxShadow: "var(--shadow-lg)",
                    }}
                    labelStyle={{ color: "var(--tooltip-foreground)", fontWeight: 600 }}
                    itemStyle={{ color: "var(--tooltip-foreground)" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                  <Bar dataKey="Tarefas" fill="var(--chart-1)" radius={[6, 6, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="Demandas" fill="var(--chart-2)" radius={[6, 6, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="Reuniões" fill="var(--chart-4)" radius={[6, 6, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="Relatórios" fill="var(--chart-3)" radius={[6, 6, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>

        <Panel
          title="Status das tarefas"
          actions={
            <Link to="/tarefas" className="text-xs font-medium text-primary hover:underline">
              Ver todas →
            </Link>
          }
        >
          <div className="h-72">
            {pieTarefas.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Sem tarefas ainda.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieTarefas}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {pieTarefas.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="var(--card)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid var(--tooltip-border)",
                      background: "var(--tooltip-bg)",
                      color: "var(--tooltip-foreground)",
                      fontSize: 12,
                      boxShadow: "var(--shadow-lg)",
                    }}
                    labelStyle={{ color: "var(--tooltip-foreground)", fontWeight: 600 }}
                    itemStyle={{ color: "var(--tooltip-foreground)" }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: 11 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>
      </div>

      {/* Linha 3 — Atividades + Equipe */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Atividades da semana"
          className="lg:col-span-2"
          actions={
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {format(weekStart, "dd MMM", { locale: ptBR })} –{" "}
                {format(weekEnd, "dd MMM", { locale: ptBR })}
              </span>
              <Link
                to="/atividades"
                className="text-xs font-medium text-primary hover:underline"
              >
                Agenda →
              </Link>
            </div>
          }
          bodyClassName="p-2"
        >
          <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
            {atividades.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                Nenhuma atividade nesta semana.
              </div>
            ) : (
              atividades.slice(0, 8).map((a) => {
                const tone =
                  a.tipo === "reuniao"
                    ? "info"
                    : a.tipo === "tarefa"
                      ? "warning"
                      : "primary";
                const Icon =
                  a.tipo === "reuniao" ? Calendar : a.tipo === "tarefa" ? CheckSquare : Inbox;
                return (
                  <button
                    key={`${a.tipo}-${a.id}`}
                    type="button"
                    onClick={() => openPreview(a)}
                    className="list-item-interactive group"
                  >
                    <span className={cn("type-dot", `type-dot-${tone}`)} />
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{a.titulo}</span>
                        {a.prioridade === "alta" || a.prioridade === "critica" ? (
                          <Badge variant="destructive" className="text-[9px] uppercase">
                            {a.prioridade}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {format(new Date(a.data!), "EEE, dd/MM 'às' HH:mm", { locale: ptBR })}
                        {a.responsavel && ` · ${a.responsavel}`}
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                );
              })
            )}
            {atividades.length > 8 && (
              <Link
                to="/atividades"
                className="block py-2 text-center text-xs font-medium text-primary hover:underline"
              >
                Ver mais {atividades.length - 8} atividades →
              </Link>
            )}
          </div>
        </Panel>

        <Panel
          title="Equipe ativa"
          actions={
            <Link to="/equipe" className="text-xs font-medium text-primary hover:underline">
              Gerenciar →
            </Link>
          }
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg border bg-muted/30 p-3">
                <Users className="mx-auto mb-1 h-4 w-4 text-primary" />
                <p className="text-xl font-semibold tabular-nums">{colaboradores.length}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Colaboradores
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <Plane className="mx-auto mb-1 h-4 w-4 text-warning" />
                <p className="text-xl font-semibold tabular-nums">{feriasAtivas}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  De férias
                </p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Próximas férias
              </p>
              {proximasFerias.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma programada.</p>
              ) : (
                <ul className="space-y-2">
                  {proximasFerias.map((f: any) => (
                    <li key={f.id} className="flex items-center gap-2 text-xs">
                      <Avatar className="h-6 w-6">
                        {f.colaborador?.foto_url && (
                          <AvatarImage src={f.colaborador.foto_url} />
                        )}
                        <AvatarFallback className="bg-primary/10 text-[9px] text-primary">
                          {(f.colaborador?.nome ?? "?").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">
                        {f.colaborador?.nome?.split(" ")[0] ?? "—"}
                      </span>
                      <span className="text-muted-foreground">
                        {format(new Date(f.data_inicio), "dd/MM")} –{" "}
                        {format(new Date(f.data_fim), "dd/MM")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Panel>
      </div>

      {/* Linha 4 — Workflow + Horários */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Workflow de chamados"
          className="lg:col-span-2"
          actions={
            <Link to="/relatorios" className="text-xs font-medium text-primary hover:underline">
              Ver relatórios →
            </Link>
          }
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <WorkflowStep
              icon={Inbox}
              label="Aberto"
              value={chamados.filter((c) => c.status === "aberto").length}
              tone="warning"
              to="/relatorios"
            />
            <WorkflowStep
              icon={ArrowRight}
              label="Encaminhado"
              value={relatEncaminhados}
              tone="info"
              to="/relatorios"
            />
            <WorkflowStep
              icon={CheckSquare}
              label="Finalizado"
              value={chamados.filter((c) => c.status === "finalizado").length}
              tone="success"
              to="/relatorios"
            />
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Tarefas internas (workflow Sisteplan)
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <WorkflowStep
                icon={Inbox}
                label="Abertura"
                value={tarefas.filter((t) => ["aberta", "pendente"].includes(t.status)).length}
                tone="warning"
                to="/tarefas"
              />
              <WorkflowStep
                icon={ArrowRight}
                label="Encaminhada"
                value={tarefas.filter((t) => t.status === "encaminhada").length}
                tone="info"
                to="/tarefas"
              />
              <WorkflowStep
                icon={CheckSquare}
                label="Homologação"
                value={taskHML}
                tone="primary"
                to="/tarefas"
              />
              <WorkflowStep
                icon={CheckSquare}
                label="Produção"
                value={taskProd}
                tone="success"
                to="/tarefas"
              />
              <WorkflowStep
                icon={CheckSquare}
                label="Concluída"
                value={tarefas.filter((t) => t.status === "concluida").length}
                tone="success"
                to="/tarefas"
              />
            </div>
          </div>
        </Panel>

        <Panel
          title="Horários (segunda)"
          actions={
            <Link to="/equipe" className="text-xs font-medium text-primary hover:underline">
              Editar →
            </Link>
          }
        >
          {horarios.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Cadastre horários em <Link to="/equipe" className="font-medium text-primary hover:underline">Equipe</Link>.
            </p>
          ) : (
            <ul className="divide-y divide-border/50">
              {horarios.map((h, i) => (
                <li key={i} className="flex items-center gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                  <Avatar className="h-8 w-8 shrink-0">
                    {h.foto && <AvatarImage src={h.foto} />}
                    <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                      {h.nome.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium leading-tight">{h.nome}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-foreground/80">
                        <Clock className="h-3 w-3 text-primary" />
                        {h.expediente}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                        <span aria-hidden>🍽</span>
                        {h.almoco}
                        <span className="text-muted-foreground/80">· {h.local}</span>
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <PreviewDialog item={preview} open={previewOpen} onOpenChange={setPreviewOpen} />
    </div>
  );
}

function WorkflowStep({
  icon: Icon,
  label,
  value,
  tone,
  to,
}: {
  icon: any;
  label: string;
  value: number;
  tone: "primary" | "success" | "warning" | "info";
  to?: string;
}) {
  const toneClass: Record<string, string> = {
    primary: "border-primary/30 bg-primary/5 text-primary",
    success: "border-success/30 bg-success/5 text-success",
    warning: "border-warning/40 bg-warning/5 text-warning",
    info: "border-info/30 bg-info/5 text-info",
  };
  const inner = (
    <>
      <Icon className="mb-1.5 h-4 w-4" />
      <p className="text-2xl font-semibold tabular-nums leading-none text-foreground">{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </>
  );
  const cls = cn("workflow-step", toneClass[tone]);
  if (to) {
    return (
      <Link to={to} className={cls} aria-label={`${label}: ${value}`}>
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
}
