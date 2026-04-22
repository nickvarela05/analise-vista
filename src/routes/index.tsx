import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { format, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { StatCard, PanelCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
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
  const { data: chamados = [] } = useQuery({
    queryKey: ["dash-chamados"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chamado_externo").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: tarefas = [] } = useQuery({
    queryKey: ["dash-tarefas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("todo").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: reunioes = [] } = useQuery({
    queryKey: ["dash-reunioes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reuniao").select("*").order("data_reuniao");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: avisos = [] } = useQuery({
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
        .select("*, colaborador(nome)")
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

  // KPIs
  const relatPendentes = chamados.filter((c) => !["concluido", "cancelado", "reprovado"].includes(c.status)).length;
  const relatFeitos = chamados.filter((c) => c.status === "concluido").length;

  const avisosAlta = avisos.filter((a) => a.tipo === "critico").length;
  const avisosMedia = avisos.filter((a) => a.tipo === "alerta").length;
  const avisosBaixa = avisos.filter((a) => a.tipo === "informativo").length;

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const reunioesSemana = reunioes.filter((r) =>
    isWithinInterval(new Date(r.data_reuniao), { start: weekStart, end: weekEnd }),
  ).length;
  const reunioesFuturas = reunioes.filter((r) => {
    const d = new Date(r.data_reuniao);
    return d > weekEnd;
  }).length;
  const reunioesFeitas = reunioes.filter((r) => r.status === "realizada").length;

  // Tarefas por status workflow
  const taskHML = tarefas.filter((t) => t.status === "homologacao").length;
  const taskProd = tarefas.filter((t) => t.status === "producao").length;
  const taskAbertas = tarefas.filter((t) => ["aberta", "pendente", "encaminhada"].includes(t.status)).length;
  const taskUrgentes = tarefas.filter((t) => t.prioridade === "alta").length;
  const taskReprov = tarefas.filter((t) => t.status === "reprovada").length;

  // Atribuições por colaborador (gráfico)
  const atribuicoes = colaboradores.map((c) => {
    const tDoColab = tarefas.filter((t) => t.responsavel_id === c.id).length;
    const dDoColab = demandas.filter((d) => d.responsavel_id === c.id).length;
    const rDoColab = reunioes.filter((r) => r.responsavel_id === c.id).length;
    return {
      nome: c.nome.split(" ")[0],
      Tarefas: tDoColab,
      Demandas: dDoColab,
      Reuniões: rDoColab,
    };
  });

  // Atividades semanais = demandas/tarefas com prazo na semana + reuniões da semana
  type AtividadeSemana = {
    tipo: "tarefa" | "demanda" | "reuniao";
    titulo: string;
    data: Date;
    extra: string;
    prioridade?: string;
  };
  const atividades: AtividadeSemana[] = [];
  tarefas.forEach((t) => {
    if (t.data_prevista) {
      const d = new Date(t.data_prevista);
      if (isWithinInterval(d, { start: weekStart, end: weekEnd })) {
        atividades.push({
          tipo: "tarefa",
          titulo: t.titulo,
          data: d,
          extra: `Prazo: ${format(d, "dd/MM/yyyy")}`,
          prioridade: t.prioridade,
        });
      }
    }
  });
  demandas.forEach((d) => {
    if (d.prazo) {
      const dt = new Date(d.prazo);
      if (isWithinInterval(dt, { start: weekStart, end: weekEnd })) {
        atividades.push({
          tipo: "demanda",
          titulo: d.titulo,
          data: dt,
          extra: `Prazo: ${format(dt, "dd/MM/yyyy")}`,
          prioridade: d.prioridade,
        });
      }
    }
  });
  reunioes.forEach((r) => {
    const dt = new Date(r.data_reuniao);
    if (isWithinInterval(dt, { start: weekStart, end: weekEnd })) {
      atividades.push({
        tipo: "reuniao",
        titulo: r.titulo,
        data: dt,
        extra: `${format(dt, "dd/MM 'às' HH:mm")}`,
      });
    }
  });
  atividades.sort((a, b) => a.data.getTime() - b.data.getTime());

  const proximasFerias = ferias.slice(0, 4);

  // Horários (pega do primeiro dia da semana de cada colaborador)
  const horarios = colaboradores
    .map((c) => {
      const seg = (c.colaborador_horario ?? []).find((h: any) => h.dia_semana === 1);
      if (!seg) return null;
      return {
        nome: c.nome.split(" ")[0],
        expediente: `${seg.expediente_inicio?.slice(0, 5) ?? "—"} às ${seg.expediente_fim?.slice(0, 5) ?? "—"}`,
        almoco: seg.almoco_inicio
          ? `${seg.almoco_inicio.slice(0, 5)} às ${seg.almoco_fim?.slice(0, 5)} (${seg.local_almoco ?? ""})`
          : "—",
      };
    })
    .filter(Boolean) as { nome: string; expediente: string; almoco: string }[];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Painel gerencial — Equipe de Análise de Requisitos."
      />

      {/* Avisos críticos no topo */}
      {avisos.length > 0 && (
        <div className="mb-6 space-y-2">
          {avisos.slice(0, 3).map((a) => (
            <div
              key={a.id}
              className={`flex items-start gap-3 rounded-lg border p-4 ${
                a.tipo === "critico"
                  ? "border-destructive/40 bg-destructive/5"
                  : a.tipo === "alerta"
                    ? "border-warning/40 bg-warning/5"
                    : "border-info/40 bg-info/5"
              }`}
            >
              <AlertTriangle
                className={`mt-0.5 h-4 w-4 ${
                  a.tipo === "critico"
                    ? "text-destructive"
                    : a.tipo === "alerta"
                      ? "text-warning"
                      : "text-info"
                }`}
              />
              <div className="flex-1">
                <p className="text-sm font-medium">{a.titulo}</p>
                <p className="text-xs text-muted-foreground">{a.mensagem}</p>
              </div>
              <Badge variant="outline" className="uppercase text-[10px]">
                {a.tipo}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Linha 1 — Cards no estilo da imagem */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Relatórios"
          items={[
            { value: relatPendentes, label: "Pendentes", tone: "warning" },
            { value: relatFeitos, label: "Feitos", tone: "success" },
          ]}
        />
        <StatCard
          title="Avisos"
          items={[
            { value: avisosAlta, label: "Alta", tone: "destructive" },
            { value: avisosMedia, label: "Média", tone: "warning" },
            { value: avisosBaixa, label: "Baixa", tone: "info" },
          ]}
          size="sm"
        />
        <StatCard
          title="Reuniões"
          items={[
            { value: reunioesSemana, label: "Semana atual", tone: "primary" },
            { value: reunioesFuturas, label: ">7 dias", tone: "info" },
            { value: reunioesFeitas, label: "Feitas", tone: "success" },
          ]}
          size="sm"
        />
        <PanelCard title="Férias">
          {proximasFerias.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma férias programada.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {proximasFerias.map((f: any) => (
                <li key={f.id} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="font-medium">{f.colaborador?.nome?.split(" ")[0] ?? "—"}:</span>
                  <span className="text-muted-foreground">
                    {format(new Date(f.data_inicio), "dd/MM")} a {format(new Date(f.data_fim), "dd/MM")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>
      </div>

      {/* Linha 2 — BI + Atividades semanais + Horários */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <PanelCard title="Atribuições (Equipe de análise)" className="lg:col-span-1">
          <div className="h-72">
            {atribuicoes.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Sem dados ainda.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={atribuicoes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="nome" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--popover)",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Tarefas" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Demandas" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Reuniões" fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </PanelCard>

        <PanelCard title="Atividades semanais" actions={
          <span className="text-[10px] uppercase text-muted-foreground">
            {format(weekStart, "dd/MM", { locale: ptBR })} – {format(weekEnd, "dd/MM", { locale: ptBR })}
          </span>
        }>
          <div className="max-h-72 overflow-y-auto pr-2">
            {atividades.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma atividade nesta semana.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {atividades.slice(0, 8).map((a, i) => (
                  <li key={i} className="border-l-2 border-primary/40 pl-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px] uppercase">{a.tipo}</Badge>
                      {a.prioridade && (
                        <span className="text-[10px] uppercase text-muted-foreground">
                          Urg.: {a.prioridade}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-medium leading-tight">{a.titulo}</p>
                    <p className="text-xs text-muted-foreground">{a.extra}</p>
                  </li>
                ))}
              </ul>
            )}
            {atividades.length > 8 && (
              <Link to="/atividades" className="mt-3 inline-block text-xs font-medium text-primary hover:underline">
                Ver mais {atividades.length - 8} atividades →
              </Link>
            )}
          </div>
        </PanelCard>

        <PanelCard title="Horários da equipe">
          <div className="max-h-72 space-y-3 overflow-y-auto pr-2 text-sm">
            {horarios.length === 0 ? (
              <p className="text-muted-foreground">Cadastre horários em Equipe.</p>
            ) : (
              <>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Expediente
                  </p>
                  <ul className="space-y-1">
                    {horarios.map((h, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" />
                        <span className="font-medium">{h.nome}:</span>
                        <span className="text-muted-foreground">{h.expediente}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="border-t border-border pt-2">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Almoço
                  </p>
                  <ul className="space-y-1">
                    {horarios.map((h, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                        <span className="font-medium">{h.nome}:</span>
                        <span className="text-muted-foreground">{h.almoco}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        </PanelCard>
      </div>

      {/* Linha 3 — Tarefas em círculo */}
      <div className="mt-8">
        <StatCard
          title="Tarefas"
          items={[
            { value: taskHML, label: "Em HML", tone: "info" },
            { value: taskProd, label: "Produção", tone: "primary" },
            { value: taskAbertas, label: "Abertas", tone: "warning" },
            { value: taskUrgentes, label: "Urgentes", tone: "destructive" },
            { value: taskReprov, label: "Reprovadas", tone: "destructive" },
          ]}
          size="sm"
        />
      </div>
    </div>
  );
}
