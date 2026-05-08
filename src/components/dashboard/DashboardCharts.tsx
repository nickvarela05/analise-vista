import { Link } from "@tanstack/react-router";
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
import { Panel } from "@/components/KpiTile";

interface AtribRow {
  nome: string;
  Tarefas: number;
  Demandas: number;
  Reuniões: number;
  Relatórios: number;
  Total: number;
}

interface PieRow {
  name: string;
  value: number;
  color: string;
}

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid var(--tooltip-border)",
  background: "var(--tooltip-bg)",
  color: "var(--tooltip-foreground)",
  fontSize: 12,
  boxShadow: "var(--shadow-lg)",
};
const tooltipLabel = { color: "var(--tooltip-foreground)", fontWeight: 600 };
const tooltipItem = { color: "var(--tooltip-foreground)" };

export function AtribuicoesChart({ data }: { data: AtribRow[] }) {
  return (
    <Panel
      title="Atribuições por colaborador"
      className="lg:col-span-2"
      actions={
        <Link to="/equipe" className="text-xs font-medium text-primary hover:underline">
          Ver equipe →
        </Link>
      }
    >
      <div className="h-72">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Nenhum colaborador cadastrado.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="nome" fontSize={11} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" />
              <YAxis allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" />
              <Tooltip
                cursor={{ fill: "color-mix(in oklab, var(--primary) 6%, transparent)" }}
                contentStyle={tooltipStyle}
                labelStyle={tooltipLabel}
                itemStyle={tooltipItem}
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
  );
}

export function StatusTarefasPie({ data }: { data: PieRow[] }) {
  return (
    <Panel
      title="Status das tarefas"
      actions={
        <Link to="/tarefas" className="text-xs font-medium text-primary hover:underline">
          Ver todas →
        </Link>
      }
    >
      <div className="h-72">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Sem tarefas ainda.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="var(--card)" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={tooltipItem} />
              <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </Panel>
  );
}
