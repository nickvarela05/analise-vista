import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
import { cn } from "@/lib/utils";
import type { TarefaRow, DemandaRow, ReuniaoRow } from "@/lib/db-types";
import {
  computeVelocity,
  computeLeadCycle,
  computeThroughput,
  computeAging,
  computeHeatmap,
  computeWip,
  computeTaxaReprovacao,
  computeTempoPorEtapa,
  computeCategoriaOrigem,
  computeFunilRelatorios,
  computeSlaUrgencia,
  computeTopSolicitantes,
} from "./lib/metrics";

type Colab = { id: string; nome: string };
type Solic = {
  status: string | null;
  urgencia: string | null;
  criado_em: string | null;
  prazo: string | null;
  solicitante_nome: string | null;
  categoria: string | null;
};

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

function Empty({ msg }: { msg: string }) {
  return (
    <div className="flex h-full min-h-32 items-center justify-center text-center text-xs text-muted-foreground">
      {msg}
    </div>
  );
}

/* ============================================================
 * #1 Velocity semanal
 * ============================================================ */
export function VelocitySemanalCard({ tarefas }: { tarefas: TarefaRow[] }) {
  const data = React.useMemo(() => computeVelocity(tarefas, 8), [tarefas]);
  const total = data.reduce((s, d) => s + d.concluidas, 0);
  return (
    <Panel
      title="Entregas por semana"
      hint="Quantidade de tarefas concluídas por semana, nas últimas 8 semanas. Tendência ascendente indica que a equipe está acelerando as entregas."
    >
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{total}</span>
        <span className="text-xs text-muted-foreground">entregas em 8 semanas</span>
      </div>
      <div className="h-44">
        {total === 0 ? (
          <Empty msg="Sem entregas registradas no período." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="semana" fontSize={10} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" />
              <YAxis allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={tooltipItem} />
              <Bar dataKey="concluidas" name="Concluídas" fill="var(--chart-2)" radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Panel>
  );
}

/* ============================================================
 * #2 Lead time / Cycle time
 * ============================================================ */
export function LeadTimeCard({ tarefas }: { tarefas: TarefaRow[] }) {
  const m = React.useMemo(() => computeLeadCycle(tarefas), [tarefas]);
  return (
    <Panel
      title="Tempo médio de entrega"
      hint="Tempo médio (e mediano) entre a criação e a conclusão de uma tarefa. Mediana é mais robusta a casos extremos."
    >
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Média</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{m.leadAvg.toFixed(1)}<span className="ml-1 text-xs font-normal text-muted-foreground">dias</span></p>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Mediana</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{m.leadMedian.toFixed(1)}<span className="ml-1 text-xs font-normal text-muted-foreground">dias</span></p>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">Baseado em {m.amostra} {m.amostra === 1 ? "tarefa concluída" : "tarefas concluídas"}.</p>
    </Panel>
  );
}

/* ============================================================
 * #3 Throughput por colaborador
 * ============================================================ */
export function ThroughputCard({ tarefas, colaboradores }: { tarefas: TarefaRow[]; colaboradores: Colab[] }) {
  const data = React.useMemo(() => computeThroughput(tarefas, colaboradores, 30), [tarefas, colaboradores]);
  return (
    <Panel
      title="Quem mais entregou (30 dias)"
      hint="Quantidade de tarefas concluídas por cada pessoa nos últimos 30 dias. Útil para identificar quem está entregando mais e equilibrar a carga."
    >
      <div className="h-44">
        {data.length === 0 ? (
          <Empty msg="Ninguém concluiu tarefas nos últimos 30 dias." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} fontSize={10} stroke="var(--muted-foreground)" />
              <YAxis type="category" dataKey="nome" width={70} fontSize={10} stroke="var(--muted-foreground)" />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={tooltipItem} />
              <Bar dataKey="total" name="Concluídas" fill="var(--chart-1)" radius={[0, 6, 6, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Panel>
  );
}

/* ============================================================
 * #4 Aging do backlog
 * ============================================================ */
const TONE_BG: Record<string, string> = {
  success: "var(--success)",
  info: "var(--info)",
  warning: "var(--warning)",
  destructive: "var(--destructive)",
};
export function AgingBacklogCard({ tarefas }: { tarefas: TarefaRow[] }) {
  const data = React.useMemo(() => computeAging(tarefas), [tarefas]);
  const total = data.reduce((s, b) => s + b.total, 0);
  const envelhecidas = data.filter((b) => b.tone === "warning" || b.tone === "destructive").reduce((s, b) => s + b.total, 0);
  return (
    <Panel
      title="Idade das tarefas em aberto"
      hint="Distribuição das tarefas ativas pelo tempo desde a criação. Itens com mais de 15 dias merecem atenção; com mais de 30 são alerta."
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <p className="text-2xl font-semibold tabular-nums">{total}</p>
          <p className="text-[11px] text-muted-foreground">tarefas ativas</p>
        </div>
        <div className="text-right">
          <p className={cn("text-2xl font-semibold tabular-nums", envelhecidas > 0 ? "text-warning" : "text-success")}>{envelhecidas}</p>
          <p className="text-[11px] text-muted-foreground">com 8+ dias</p>
        </div>
      </div>
      {total === 0 ? (
        <Empty msg="Nenhuma tarefa ativa no backlog." />
      ) : (
        <div className="space-y-2">
          {data.map((b) => {
            const pct = total ? (b.total / total) * 100 : 0;
            return (
              <div key={b.faixa}>
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">{b.faixa}</span>
                  <span className="font-medium tabular-nums">{b.total}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: TONE_BG[b.tone] }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/* ============================================================
 * #5 Heatmap de prazos (28 dias)
 * ============================================================ */
export function HeatmapPrazosCard({
  tarefas, demandas, reunioes,
}: { tarefas: TarefaRow[]; demandas: DemandaRow[]; reunioes: ReuniaoRow[] }) {
  const { grid, max } = React.useMemo(
    () => computeHeatmap(tarefas, demandas, reunioes, 28),
    [tarefas, demandas, reunioes],
  );
  const dows = ["S", "T", "Q", "Q", "S", "S", "D"];
  return (
    <Panel
      title="Mapa de calor — próximos 28 dias"
      hint="Intensidade representa a soma de prazos de tarefas, demandas e reuniões agendadas em cada dia. Picos indicam dias com risco de sobrecarga."
    >
      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-1.5">
          {dows.map((d, i) => (
            <div key={i} className="text-center text-[10px] font-medium text-muted-foreground">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {grid.map((cell, i) => {
            const intensity = cell.count / max;
            const bg = cell.count === 0
              ? "var(--muted)"
              : `color-mix(in oklab, var(--primary) ${Math.round(15 + intensity * 75)}%, var(--card))`;
            return (
              <div
                key={i}
                className="group relative aspect-square rounded-md border border-border/40 transition-transform hover:scale-110"
                style={{ background: bg }}
                title={`${format(cell.date, "EEE dd/MM", { locale: ptBR })} — ${cell.count} ${cell.count === 1 ? "compromisso" : "compromissos"}`}
              >
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-foreground/80">
                  {cell.count > 0 ? cell.count : ""}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-end gap-2 pt-1 text-[10px] text-muted-foreground">
          <span>menos</span>
          {[0.15, 0.4, 0.7, 0.9].map((v) => (
            <div
              key={v}
              className="h-3 w-3 rounded"
              style={{ background: `color-mix(in oklab, var(--primary) ${Math.round(v * 100)}%, var(--card))` }}
            />
          ))}
          <span>mais</span>
        </div>
      </div>
    </Panel>
  );
}

/* ============================================================
 * #6 WIP por colaborador
 * ============================================================ */
const WIP_LIMITE = 5;
export function WipColaboradorCard({ tarefas, colaboradores }: { tarefas: TarefaRow[]; colaboradores: Colab[] }) {
  const data = React.useMemo(() => computeWip(tarefas, colaboradores), [tarefas, colaboradores]);
  return (
    <Panel
      title="Carga atual por pessoa"
      hint={`Trabalho em progresso atual (em desenvolvimento, encaminhada ou homologação) por pessoa. Acima de ${WIP_LIMITE} itens simultâneos sugere sobrecarga.`}
    >
      {data.length === 0 ? (
        <Empty msg="Ninguém com tarefas em andamento agora." />
      ) : (
        <div className="space-y-2">
          {data.map((d) => {
            const overflow = d.wip > WIP_LIMITE;
            const pct = Math.min(100, (d.wip / Math.max(WIP_LIMITE * 1.5, 6)) * 100);
            return (
              <div key={d.nome}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">{d.nome}</span>
                  <span className={cn("tabular-nums", overflow ? "text-warning font-semibold" : "text-muted-foreground")}>
                    {d.wip}
                  </span>
                </div>
                <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: overflow ? "var(--warning)" : "var(--chart-1)",
                    }}
                  />
                  <div
                    className="absolute top-0 h-full w-px bg-border"
                    style={{ left: `${(WIP_LIMITE / Math.max(WIP_LIMITE * 1.5, 6)) * 100}%` }}
                    aria-hidden
                  />
                </div>
              </div>
            );
          })}
          <p className="pt-1 text-[10px] text-muted-foreground">A linha vertical marca o limite saudável ({WIP_LIMITE}).</p>
        </div>
      )}
    </Panel>
  );
}

/* ============================================================
 * #7 Taxa de reprovação em homologação
 * ============================================================ */
export function TaxaReprovacaoCard({ tarefas }: { tarefas: TarefaRow[] }) {
  const m = React.useMemo(() => computeTaxaReprovacao(tarefas, 60), [tarefas]);
  const tone = m.taxa === 0 ? "success" : m.taxa < 15 ? "info" : m.taxa < 30 ? "warning" : "destructive";
  const data = [
    { name: "Aprovadas", value: m.aprov, color: "var(--success)" },
    { name: "Reprovadas", value: m.reprov, color: "var(--destructive)" },
  ].filter((d) => d.value > 0);
  return (
    <Panel
      title="Reprovações em homologação"
      hint="Percentual de tarefas reprovadas em homologação nos últimos 60 dias. Valores altos indicam falhas de qualidade ou requisitos mal alinhados."
    >
      <div className="grid grid-cols-2 items-center gap-2">
        <div>
          <p className={cn(
            "text-3xl font-semibold tabular-nums",
            tone === "success" && "text-success",
            tone === "info" && "text-info",
            tone === "warning" && "text-warning",
            tone === "destructive" && "text-destructive",
          )}>
            {m.taxa.toFixed(1)}%
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {m.reprov} reprovada{m.reprov === 1 ? "" : "s"} de {m.total} avaliadas
          </p>
          <p className="mt-2 text-[10px] text-muted-foreground">Janela: 60 dias</p>
        </div>
        <div className="h-32">
          {m.total === 0 ? (
            <Empty msg="Sem dados." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" innerRadius={32} outerRadius={50} paddingAngle={2}>
                  {data.map((e, i) => <Cell key={i} fill={e.color} stroke="var(--card)" strokeWidth={2} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={tooltipItem} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </Panel>
  );
}

/* ============================================================
 * #8 Tempo médio por etapa
 * ============================================================ */
export function TempoPorEtapaCard({ tarefas }: { tarefas: TarefaRow[] }) {
  const data = React.useMemo(() => computeTempoPorEtapa(tarefas), [tarefas]);
  return (
    <Panel
      title="Tempo médio por etapa"
      hint="Tempo médio (em dias) que as tarefas permanecem em cada etapa do fluxo. Aproximação baseada em created_at → updated_at do status atual."
    >
      <div className="h-48">
        {data.length === 0 ? (
          <Empty msg="Sem tarefas para calcular." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" fontSize={10} stroke="var(--muted-foreground)" />
              <YAxis type="category" dataKey="etapa" width={100} fontSize={10} stroke="var(--muted-foreground)" />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={tooltipItem}
                formatter={(v: number) => [`${v} dias`, "Tempo médio"]} />
              <Bar dataKey="dias" fill="var(--chart-4)" radius={[0, 6, 6, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Panel>
  );
}

/* ============================================================
 * #9 Categoria & Origem das demandas
 * ============================================================ */
const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--info)"];
export function CategoriaOrigemCard({ demandas }: { demandas: DemandaRow[] }) {
  const { categorias, origens } = React.useMemo(() => computeCategoriaOrigem(demandas), [demandas]);
  return (
    <Panel
      title="De onde vêm as demandas"
      hint="De que tipo são as demandas (bug, melhoria, dúvida…) e por qual canal chegam (e-mail, reunião, chamado…)."
    >
      <div className="grid grid-cols-2 gap-2">
        <MiniDonut title="Categoria" data={categorias} />
        <MiniDonut title="Origem" data={origens} />
      </div>
    </Panel>
  );
}
function MiniDonut({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  if (data.length === 0) {
    return (
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
        <Empty msg="Sem dados." />
      </div>
    );
  }
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={28} outerRadius={48} paddingAngle={2}>
              {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="var(--card)" strokeWidth={2} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={tooltipItem} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-1 space-y-0.5 text-[10px]">
        {data.slice(0, 4).map((d, i) => (
          <li key={d.name} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 truncate text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
              {d.name}
            </span>
            <span className="tabular-nums font-medium">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ============================================================
 * #10 Funil de relatórios
 * ============================================================ */
export function FunilRelatoriosCard({ solicitacoes }: { solicitacoes: Solic[] }) {
  const data = React.useMemo(() => computeFunilRelatorios(solicitacoes), [solicitacoes]);
  const tones = ["var(--warning)", "var(--success)"];
  const labels = ["Recebido pela equipe", "Pronto / em produção"];
  const total = data.reduce((s, x) => s + x.total, 0);
  return (
    <Panel
      title="Andamento dos relatórios"
      hint="Relatórios ativos: pendentes (a fazer) e feitos (prontos). Enviados não entram na contagem."
    >

      {total === 0 ? (
        <Empty msg="Nenhuma solicitação registrada." />
      ) : (
        <div className="space-y-2">
          {data.map((d, i) => (
            <div key={d.etapa}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium">{d.etapa}</span>
                <span className="tabular-nums text-muted-foreground">{d.total} ({d.pct}%)</span>
              </div>
              <div className="h-7 overflow-hidden rounded-md bg-muted">
                <div
                  className="flex h-full items-center justify-end px-2 text-[10px] font-semibold text-background transition-all"
                  style={{ width: `${Math.max(d.pct, 4)}%`, background: tones[i] }}
                >
                  {d.total > 0 ? d.total : ""}
                </div>
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{labels[i]}</p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ============================================================
 * #11 SLA por urgência
 * ============================================================ */
export function SlaUrgenciaCard({ solicitacoes }: { solicitacoes: Solic[] }) {
  const data = React.useMemo(() => computeSlaUrgencia(solicitacoes), [solicitacoes]);
  return (
    <Panel
      title="Pendências por urgência"
      hint="Quantidade de solicitações pendentes por nível de urgência e idade média (dias) desde a criação. Pendências urgentes com idade alta = risco de SLA estourado."
    >
      <div className="h-48">
        {data.length === 0 ? (
          <Empty msg="Nenhuma pendência no momento." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="urgencia" fontSize={10} stroke="var(--muted-foreground)" />
              <YAxis allowDecimals={false} fontSize={10} stroke="var(--muted-foreground)" />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={tooltipItem} />
              <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" />
              <Bar dataKey="pendentes" name="Pendentes" fill="var(--chart-3)" radius={[6, 6, 0, 0]} maxBarSize={28} />
              <Bar dataKey="idadeMedia" name="Idade média (dias)" fill="var(--chart-5)" radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Panel>
  );
}

/* ============================================================
 * #12 Top solicitantes
 * ============================================================ */
export function TopSolicitantesCard({ solicitacoes }: { solicitacoes: Solic[] }) {
  const data = React.useMemo(() => computeTopSolicitantes(solicitacoes, 90, 8), [solicitacoes]);
  return (
    <Panel
      title="Quem mais pede relatórios (90 dias)"
      hint="Pessoas que mais pediram relatórios nos últimos 90 dias. Útil para identificar clientes recorrentes e priorizar relacionamento."
    >
      <div className="h-48">
        {data.length === 0 ? (
          <Empty msg="Sem solicitações no período." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} fontSize={10} stroke="var(--muted-foreground)" />
              <YAxis type="category" dataKey="nome" width={110} fontSize={10} stroke="var(--muted-foreground)" />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={tooltipItem} />
              <Bar dataKey="total" name="Solicitações" fill="var(--chart-2)" radius={[0, 6, 6, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Panel>
  );
}
