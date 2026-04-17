import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Inbox,
  CheckSquare,
  Calendar,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  PieChart,
  Pie,
  Cell,
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

const STATUS_COLORS: Record<string, string> = {
  aberta: "oklch(0.6 0.13 230)",
  em_analise: "oklch(0.78 0.15 80)",
  em_andamento: "oklch(0.45 0.06 180)",
  aguardando_cliente: "oklch(0.7 0.05 60)",
  homologacao: "oklch(0.6 0.09 180)",
  concluida: "oklch(0.62 0.15 155)",
  cancelada: "oklch(0.58 0.05 30)",
};

function Dashboard() {
  const { data: demandas = [] } = useQuery({
    queryKey: ["dash-demandas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("demanda").select("status, categoria, prioridade");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: tarefas = [] } = useQuery({
    queryKey: ["dash-tarefas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("todo").select("status");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: reunioes = [] } = useQuery({
    queryKey: ["dash-reunioes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reuniao").select("status, data_reuniao");
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

  const statusData = Object.entries(
    demandas.reduce<Record<string, number>>((acc, d) => {
      acc[d.status] = (acc[d.status] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([status, count]) => ({ status: status.replace(/_/g, " "), count, key: status }));

  const categoriaData = Object.entries(
    demandas.reduce<Record<string, number>>((acc, d) => {
      acc[d.categoria] = (acc[d.categoria] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));

  const tarefasAbertas = tarefas.filter((t) => t.status !== "concluida" && t.status !== "cancelada").length;
  const reunioesMes = reunioes.filter((r) => {
    const d = new Date(r.data_reuniao);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Visão consolidada da equipe de Análise de Requisitos."
      />

      {/* Avisos críticos */}
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

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Demandas" value={demandas.length} icon={Inbox} hint="total registrado" />
        <KpiCard label="Tarefas abertas" value={tarefasAbertas} icon={CheckSquare} hint="pendentes ou em andamento" />
        <KpiCard label="Reuniões no mês" value={reunioesMes} icon={Calendar} hint="agendadas + realizadas" />
        <KpiCard
          label="Concluídas"
          value={demandas.filter((d) => d.status === "concluida").length}
          icon={TrendingUp}
          hint="demandas finalizadas"
        />
      </div>

      {/* Gráficos */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Demandas por status</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {statusData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 200)" />
                  <XAxis dataKey="status" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--popover)",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {statusData.map((entry) => (
                      <Cell key={entry.key} fill={STATUS_COLORS[entry.key] ?? "var(--primary)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Demandas por categoria</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {categoriaData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoriaData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {categoriaData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={[
                          "var(--chart-1)",
                          "var(--chart-2)",
                          "var(--chart-3)",
                          "var(--chart-4)",
                          "var(--chart-5)",
                          "var(--primary-glow)",
                        ][i % 6]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--popover)",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Sem dados ainda. Cadastre demandas para visualizar.
    </div>
  );
}
