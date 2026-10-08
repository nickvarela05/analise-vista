import * as React from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { differenceInHours, isSameMonth, subDays } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, FileBarChart, Gauge, Hourglass, LineChart, Timer, Tv } from "lucide-react";
import { PageHero } from "@/components/shared/PageHero";
import { Panel } from "@/components/KpiTile";
import { Button } from "@/components/ui/button";
import { useTarefasData } from "@/components/tarefas/useTarefasData";
import { normalizeStatus } from "@/components/tarefas/lib/workflow";
import { isRelatorioPendente } from "@/lib/domain/relatorios";
import { isAtribuidoA } from "@/lib/domain/atividades";
import { relatoriosInativosQuery, solicitacoesRelatoriosQuery } from "@/lib/queries/compartilhadas";
import { cn } from "@/lib/utils";
import { mesmoNome } from "@/components/central/lib/central";
import {
  qualidadePorSistema,
  ritmoSemanal,
  SEM_SISTEMA,
  temposDeEspera,
  formatarDias,
  type Espera,
} from "./lib/metricas";
import { useEventosStatus } from "./usePainelData";

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid var(--tooltip-border)",
  background: "var(--tooltip-bg)",
  color: "var(--tooltip-foreground)",
  fontSize: 12,
};

function NumeroEspera({
  titulo,
  espera,
  explicacao,
}: {
  titulo: string;
  espera: Espera;
  explicacao: string;
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {titulo}
      </p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{formatarDias(espera.medianaDias)}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {explicacao} Mediana de {espera.amostra} {espera.amostra === 1 ? "caso" : "casos"} em 8
        semanas.
      </p>
    </div>
  );
}

/**
 * Painel da gestão (08/10/2026): o Dashboard enxuto. Cinco perguntas que a gestão faz, cada uma
 * em um número ou gráfico curto. O que saiu do Dashboard antigo e por quê está no vault
 * ("Análise de Uso e Propostas de Layout (Out-2026)").
 *
 * @param tv Modo TV: sem botões, só leitura.
 * @param onModoTv Abre o Modo TV (só fora dele).
 */
export function PainelGestao({ tv = false, onModoTv }: { tv?: boolean; onModoTv?: () => void }) {
  const { tarefas, colabs, isLoading } = useTarefasData();
  const { data: eventos = [], isLoading: carregandoEventos } = useEventosStatus();
  const { data: solicitacoes = [] } = useQuery(solicitacoesRelatoriosQuery());
  const { data: inativos = [] } = useQuery(relatoriosInativosQuery());

  const ritmo = React.useMemo(() => ritmoSemanal(eventos, 8), [eventos]);
  const testadas8 = ritmo.reduce((s, w) => s + w.aprovado + w.ressalvas + w.reprovado, 0);
  const esperas = React.useMemo(() => temposDeEspera(eventos, subDays(new Date(), 56)), [eventos]);
  const qualidade = React.useMemo(() => qualidadePorSistema(eventos, 90), [eventos]);

  const relatorios = React.useMemo(() => {
    const inat = new Set(inativos);
    const agora = new Date();
    const pendentes = solicitacoes.filter((r) => isRelatorioPendente(r, inat));
    const idades = pendentes
      .map((r) => (r.criado_em ? differenceInHours(agora, new Date(r.criado_em)) / 24 : null))
      .filter((x): x is number => x !== null && x >= 0);
    return {
      pendentes,
      noMes: solicitacoes.filter((r) => r.criado_em && isSameMonth(new Date(r.criado_em), agora))
        .length,
      idadeMedia: idades.length ? idades.reduce((a, b) => a + b, 0) / idades.length : null,
      semResponsavel: pendentes.filter((r) => !(r.responsavel ?? "").trim()).length,
    };
  }, [solicitacoes, inativos]);

  const carga = React.useMemo(() => {
    const aTestar = tarefas.filter((t) => normalizeStatus(t.status) === "homologacao");
    return colabs
      .map((c) => ({
        nome: c.nome.split(" ")[0],
        testes: aTestar.filter((t) => !t.equipe_toda && isAtribuidoA(t, c.id)).length,
        relatorios: relatorios.pendentes.filter((r) => mesmoNome(r.responsavel, c.nome)).length,
      }))
      .filter((p) => p.testes + p.relatorios > 0)
      .sort((a, b) => b.testes + b.relatorios - (a.testes + a.relatorios));
  }, [tarefas, colabs, relatorios.pendentes]);
  const maxCarga = Math.max(1, ...carga.map((p) => p.testes + p.relatorios));

  return (
    <div className="space-y-5">
      <PageHero
        loading={isLoading || carregandoEventos}
        eyebrow="Gestão"
        title="Painel da gestão"
        description="Ritmo da homologação, onde as tarefas esperam, qualidade por sistema, relatórios e carga da equipe."
        icon={Gauge}
        tone="violet"
        statsGridClassName="grid-cols-2 lg:grid-cols-4"
        actions={
          !tv && onModoTv ? (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onModoTv}>
              <Tv className="h-4 w-4" />
              Modo TV
            </Button>
          ) : undefined
        }
        stats={[
          {
            icon: LineChart,
            label: "Testadas",
            value: testadas8,
            tone: "emerald",
            hint: "Últimas 8 semanas",
          },
          {
            icon: Timer,
            label: "Em teste",
            value: formatarDias(esperas.emTeste.medianaDias),
            tone: "sky",
            hint: "Mediana até o resultado",
          },
          {
            icon: Hourglass,
            label: "Até produção",
            value: formatarDias(esperas.ateProducao.medianaDias),
            tone: "amber",
            hint: "Mediana em Pré-build",
          },
          {
            icon: FileBarChart,
            label: "Relatórios pendentes",
            value: relatorios.pendentes.length,
            tone: "rose",
            hint: `${relatorios.noMes} recebidos no mês`,
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Ritmo da homologação"
          hint="Resultados de teste por semana (segunda a domingo). Uma tarefa reprovada e depois aprovada conta nas duas semanas."
        >
          <div className={tv ? "h-72" : "h-56"}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ritmo} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="semana"
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
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                <Bar
                  dataKey="aprovado"
                  name="Aprovadas"
                  stackId="r"
                  fill="var(--success)"
                  maxBarSize={36}
                />
                <Bar
                  dataKey="ressalvas"
                  name="Com ressalvas"
                  stackId="r"
                  fill="var(--warning)"
                  maxBarSize={36}
                />
                <Bar
                  dataKey="reprovado"
                  name="Reprovadas"
                  stackId="r"
                  fill="var(--destructive)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title="Onde a tarefa espera"
          hint="Compara o tempo da equipe (teste) com o tempo do desenvolvimento (Pré-build até Produção). Só conta casos com a entrada registrada no histórico."
        >
          <div className="space-y-3">
            <NumeroEspera
              titulo="Em teste"
              espera={esperas.emTeste}
              explicacao="Da entrada em Homologação ao resultado."
            />
            <NumeroEspera
              titulo="Pré-build até Produção"
              espera={esperas.ateProducao}
              explicacao="Do envio à subida da versão."
            />
            {esperas.ateProducao.amostra < 5 && (
              <p className="text-[11px] text-muted-foreground">
                Até 08/10/2026 a mudança de status em lote não gravava histórico, então ainda há
                poucos casos medidos. O número fica confiável a partir das próximas rodadas.
              </p>
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Qualidade por sistema (90 dias)"
          hint="Tarefas testadas por sistema e quantas tiveram ressalva ou reprovação ao menos uma vez. O sistema é registrado desde 03/10/2026."
        >
          {qualidade.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Sem testes no período.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-1.5 font-semibold">Sistema</th>
                  <th className="pb-1.5 text-right font-semibold">Testadas</th>
                  <th className="pb-1.5 text-right font-semibold">Ressalva</th>
                  <th className="pb-1.5 text-right font-semibold">Reprov.</th>
                </tr>
              </thead>
              <tbody>
                {qualidade.map((q) => {
                  const pct = (n: number) => (q.testadas ? Math.round((n / q.testadas) * 100) : 0);
                  const sem = q.sistema === SEM_SISTEMA;
                  return (
                    <tr key={q.sistema} className={cn("border-t", sem && "text-muted-foreground")}>
                      <td className="py-1.5 pr-2">{q.sistema}</td>
                      <td className="py-1.5 text-right tabular-nums">{q.testadas}</td>
                      <td
                        className={cn(
                          "py-1.5 text-right tabular-nums",
                          !sem && pct(q.comRessalvas) >= 20 && "text-amber-600 dark:text-amber-400",
                        )}
                      >
                        {pct(q.comRessalvas)}%
                      </td>
                      <td
                        className={cn(
                          "py-1.5 text-right tabular-nums",
                          !sem && pct(q.reprovadas) >= 20 && "text-rose-600 dark:text-rose-400",
                        )}
                      >
                        {pct(q.reprovadas)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel
          title="Relatórios (n8n)"
          hint="Solicitações que chegam pelo n8n. Pendentes contam só as ativas (fora as inativadas e as do solicitante Google), com a mesma regra da tela Relatórios."
          actions={
            !tv ? (
              <Link
                to="/relatorios"
                className="flex items-center gap-0.5 text-xs text-primary hover:underline"
              >
                Abrir <ArrowRight className="h-3 w-3" />
              </Link>
            ) : undefined
          }
        >
          <dl className="grid grid-cols-2 gap-3">
            {[
              { rotulo: "Pendentes", valor: relatorios.pendentes.length },
              { rotulo: "Recebidos no mês", valor: relatorios.noMes },
              { rotulo: "Idade média das pendentes", valor: formatarDias(relatorios.idadeMedia) },
              {
                rotulo: "Pendentes sem responsável",
                valor: relatorios.semResponsavel,
                alerta: relatorios.semResponsavel > 0,
              },
            ].map((x) => (
              <div key={x.rotulo} className="rounded-xl border bg-muted/20 p-3">
                <dt className="text-[11px] text-muted-foreground">{x.rotulo}</dt>
                <dd
                  className={cn(
                    "mt-0.5 text-2xl font-semibold tabular-nums",
                    x.alerta && "text-amber-600 dark:text-amber-400",
                  )}
                >
                  {x.valor}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel
          title="Carga por pessoa"
          hint="O que cada pessoa tem agora: tarefas a testar (Homologação) e relatórios pendentes."
        >
          {carga.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Ninguém com teste ou relatório pendente.
            </p>
          ) : (
            <>
              <ul className="space-y-2">
                {carga.map((p) => (
                  <li key={p.nome}>
                    <div className="mb-0.5 flex justify-between text-sm">
                      <span>{p.nome}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {p.testes} teste{p.testes === 1 ? "" : "s"} · {p.relatorios} relatório
                        {p.relatorios === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="bg-sky-500"
                        style={{ width: `${(p.testes / maxCarga) * 100}%` }}
                      />
                      <div
                        className="bg-rose-500/70"
                        style={{ width: `${(p.relatorios / maxCarga) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 flex gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-sky-500" />
                  Testes
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-rose-500/70" />
                  Relatórios
                </span>
              </p>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
