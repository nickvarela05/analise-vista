import { createFileRoute } from "@tanstack/react-router";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import * as React from "react";
import {
  FileBarChart,
  Megaphone,
  Calendar,
  CheckSquare,
  ListChecks,
  FlaskConical,
  
  Inbox,
  Users,
  Gauge,
  // Activity removido (seção "Acompanhamento das tarefas" foi mesclada)
  ShieldCheck,
  CalendarClock,
  UserCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

import { MinhasAtribuicoesPainel } from "@/components/dashboard/MinhasAtribuicoesPainel";
import { MinhasAtribuicoesDialog } from "@/components/dashboard/MinhasAtribuicoesDialog";

import { startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { DashboardHero, type PulseItem } from "@/components/dashboard/DashboardHero";
import { PreviewDialog, type PreviewItem } from "@/components/PreviewDialog";
import { cargoElegivel } from "@/lib/domain/cargos";
import { contarAtribuicoes, isAtribuidoA } from "@/lib/domain/atividades";
import { useDashboardData } from "@/components/dashboard/useDashboardData";
import { AvisosBanner } from "@/components/dashboard/AvisosBanner";
import { AtribuicoesChart, StatusTarefasPie } from "@/components/dashboard/DashboardCharts";
import { AtividadesSemanaPanel, type Atividade } from "@/components/dashboard/AtividadesSemanaPanel";
import { EquipeAtivaPanel } from "@/components/dashboard/EquipeAtivaPanel";
import { HorariosPanel, type HorarioItem } from "@/components/dashboard/HorariosPanel";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import {
  VelocitySemanalCard,
  ThroughputCard,
  AgingBacklogCard,
  TaxaReprovacaoCard,
  CategoriaOrigemCard,
  FunilRelatoriosCard,
  TopSolicitantesCard,
} from "@/components/dashboard/analytics/AnalyticsCards";

export const Route = createFileRoute("/")({
  errorComponent: RouteErrorBoundary,
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
  const { user } = useAuth();
  const [preview, setPreview] = React.useState<PreviewItem | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [minhasOpen, setMinhasOpen] = React.useState(false);

  const openPreview = React.useCallback((item: PreviewItem) => {
    setPreview(item);
    setPreviewOpen(true);
  }, []);

  const {
    meuProfile,
    chamados,
    tarefas,
    reunioes,
    avisos,
    ferias,
    colaboradores,
    demandas,
    solicitacoes,
    loading,
  } = useDashboardData(user?.id);

  const meuColabId = meuProfile?.colaborador_id ?? null;

  const colabById = React.useMemo(() => {
    const map = new Map<string, { id: string; nome: string }>();
    colaboradores.forEach((c) => map.set(c.id, c));
    return map;
  }, [colaboradores]);

  // KPIs derivados
  const isPendente = (s: string | null) => (s ?? "").toLowerCase() === "pendente";
  const isRelatorio = (cat: string | null) => (cat ?? "").toLowerCase().includes("relat");

  const { solicRelatPend, solicOutrasPend } = React.useMemo(() => {
    let r = 0,
      o = 0;
    for (const s of solicitacoes) {
      if (!isPendente(s.status)) continue;
      if (isRelatorio(s.categoria)) r++;
      else o++;
    }
    return { solicRelatPend: r, solicOutrasPend: o };
  }, [solicitacoes]);

  const chamadosEncaminhados = React.useMemo(
    () => chamados.filter((c) => c.status === "encaminhado").length,
    [chamados],
  );

  const { taskAbertas, taskHML, taskProd, taskUrgentes, taskEmTeste, taskHMLEmTeste } = React.useMemo(() => {
    let abertas = 0,
      hml = 0,
      prod = 0,
      urg = 0,
      emTeste = 0,
      hmlEmTeste = 0;
    for (const t of tarefas) {
      if (t.status === "homologacao") hml++;
      if (t.status === "producao") prod++;
      const ativa = !["concluida", "producao", "reprovada", "cancelada"].includes(t.status);
      if (ativa) {
        abertas++;
        if (t.prioridade === "alta") urg++;
      }
      if ((t as any).em_teste) {
        emTeste++;
        if (t.status === "homologacao") hmlEmTeste++;
      }
    }
    return { taskAbertas: abertas, taskHML: hml, taskProd: prod, taskUrgentes: urg, taskEmTeste: emTeste, taskHMLEmTeste: hmlEmTeste };
  }, [tarefas]);


  const now = React.useMemo(() => new Date(), []);
  const weekStart = React.useMemo(() => startOfWeek(now, { weekStartsOn: 1 }), [now]);
  const weekEnd = React.useMemo(() => endOfWeek(now, { weekStartsOn: 1 }), [now]);

  const avisosCrit = React.useMemo(
    () =>
      avisos.filter(
        (a) =>
          a.tipo === "critico" &&
          (!a.expira_em || new Date(a.expira_em).getTime() > now.getTime()),
      ).length,
    [avisos, now],
  );

  const reunioesSemana = React.useMemo(
    () =>
      reunioes.filter(
        (r) =>
          r.status !== "cancelada" &&
          isWithinInterval(new Date(r.data_reuniao), { start: weekStart, end: weekEnd }),
      ).length,
    [reunioes, weekStart, weekEnd],
  );

  const feriasAtivas = React.useMemo(
    () =>
      ferias.filter((f) => {
        const inicio = new Date(f.data_inicio);
        const fim = new Date(f.data_fim);
        return inicio <= now && fim >= now;
      }).length,
    [ferias, now],
  );

  const pieTarefas = React.useMemo(
    () =>
      [
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
      ].filter((d) => d.value > 0),
    [tarefas, taskHML, taskProd],
  );

  const atribuicoes = React.useMemo(
    () =>
      colaboradores
        .filter((c) => cargoElegivel(c.cargo))
        .map((c) => {
          const tDoColab = contarAtribuicoes(tarefas, c.id);
          const dDoColab = contarAtribuicoes(demandas, c.id);
          const rDoColab = contarAtribuicoes(reunioes, c.id);
          const relDoColab = contarAtribuicoes(chamados, c.id);
          return {
            nome: c.nome.split(" ")[0],
            Tarefas: tDoColab,
            Demandas: dDoColab,
            Reuniões: rDoColab,
            Relatórios: relDoColab,
            Total: tDoColab + dDoColab + rDoColab + relDoColab,
          };
        }),
    [colaboradores, tarefas, demandas, reunioes, chamados],
  );

  const atividades = React.useMemo<Atividade[]>(() => {
    const list: Atividade[] = [];
    const envolvidos = (resp: string | null, ids: string[] | null | undefined) => {
      const set = new Set<string>();
      if (resp) set.add(resp);
      (ids ?? []).forEach((i) => i && set.add(i));
      return Array.from(set);
    };
    tarefas.forEach((t) => {
      if (t.data_prevista) {
        const d = new Date(t.data_prevista);
        if (isWithinInterval(d, { start: weekStart, end: weekEnd })) {
          list.push({
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
            _envolvidosIds: envolvidos(t.responsavel_id, t.responsaveis_ids),
            _equipeToda: t.equipe_toda ?? false,
          });
        }
      }
    });
    demandas.forEach((d) => {
      if (d.prazo) {
        const dt = new Date(d.prazo);
        if (isWithinInterval(dt, { start: weekStart, end: weekEnd })) {
          list.push({
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
            _envolvidosIds: envolvidos(d.responsavel_id, d.responsaveis_ids),
            _equipeToda: d.equipe_toda ?? false,
          });
        }
      }
    });
    reunioes.forEach((r) => {
      const dt = new Date(r.data_reuniao);
      if (isWithinInterval(dt, { start: weekStart, end: weekEnd })) {
        list.push({
          id: r.id,
          tipo: "reuniao",
          titulo: r.titulo,
          descricao: r.pauta,
          status: r.status,
          responsavel: r.responsavel_id ? colabById.get(r.responsavel_id)?.nome : null,
          data: dt,
          dataLabel: "Quando",
          _sortDate: dt.getTime(),
          _envolvidosIds: envolvidos(r.responsavel_id, r.responsaveis_ids),
          _equipeToda: r.equipe_toda ?? false,
        });
      }
    });
    list.sort((a, b) => a._sortDate - b._sortDate);
    return list;
  }, [tarefas, demandas, reunioes, colabById, weekStart, weekEnd]);

  const proximasFerias = ferias.slice(0, 4);

  const horarios = React.useMemo<HorarioItem[]>(
    () =>
      colaboradores
        .map((c) => {
          const seg = (c.colaborador_horario ?? []).find((h) => h.dia_semana === 1);
          if (!seg) return null;
          return {
            id: c.id,
            nome: c.nome.split(" ")[0],
            nomeCompleto: c.nome,
            foto: c.foto_url,
            localTrabalho: (c.local_trabalho ?? "escritorio") as "escritorio" | "rua",
            expediente: `${seg.expediente_inicio?.slice(0, 5) ?? "—"} – ${seg.expediente_fim?.slice(0, 5) ?? "—"}`,
            almoco: seg.almoco_inicio
              ? `${seg.almoco_inicio.slice(0, 5)} – ${seg.almoco_fim?.slice(0, 5)}`
              : "—",
            local: seg.local_almoco ?? "—",
          };
        })
        .filter((x): x is HorarioItem => x !== null),
    [colaboradores],
  );

  const pulseItems: PulseItem[] = [
    { icon: FileBarChart, label: "Solicitações", value: solicRelatPend, hint: "Relatórios pendentes", tone: "amber",   to: "/relatorios" },
    { icon: FlaskConical, label: "Em teste",     value: taskEmTeste,    hint: "Tarefas sinalizadas",  tone: "cyan",    to: "/tarefas" },
    { icon: CheckSquare,  label: "Homologação",  value: taskHML,        hint: `${taskUrgentes} urgentes`, tone: "indigo", to: "/tarefas" },
    { icon: Calendar,     label: "Reuniões",     value: reunioesSemana, hint: "Nesta semana",         tone: "violet",  to: "/reunioes" },
    { icon: Megaphone,    label: "Avisos",       value: avisosCrit,     hint: `${avisos.length} ativos`,  tone: "rose",   to: "/avisos" },
  ];

  return (
    <div className="space-y-6">
      <DashboardHero
        nome={meuProfile?.nome ?? null}
        subtitle="Visão consolidada da equipe de Análise de Requisitos."
        pulse={pulseItems}
        actions={
          meuColabId ? (
            <Button variant="outline" size="sm" onClick={() => setMinhasOpen(true)} className="gap-2 backdrop-blur">
              <ListChecks className="h-4 w-4" />
              Minhas atribuições
            </Button>
          ) : null
        }
      />

      <AvisosBanner avisos={avisos} onPreview={openPreview} />

      {/* === MINHAS ATRIBUIÇÕES === */}
      {meuColabId && (
        <>
          <SectionHeader
            title="Minhas atribuições"
            description="O que está direcionado a você."
            icon={UserCircle2}
            tone="primary"
          />
          <MinhasAtribuicoesPainel
            nome={meuProfile?.nome ?? null}
            colabId={meuColabId}
            tarefas={tarefas}
            demandas={demandas}
            reunioes={reunioes}
            chamados={chamados}
            onVerTodas={() => setMinhasOpen(true)}
            compact
          />
        </>
      )}

      {/* === RELATÓRIOS (N8N) === */}
      <SectionHeader
        title="Relatórios (canal externo)"
        description="Solicitações que chegam pelo fluxo N8N."
        icon={Inbox}
        tone="amber"
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <FunilRelatoriosCard solicitacoes={solicitacoes} />
        <TopSolicitantesCard solicitacoes={solicitacoes} />
      </div>

      {/* === DISTRIBUIÇÃO DA EQUIPE === */}
      <SectionHeader
        title="Distribuição da equipe"
        description="Quem está envolvido em quê."
        icon={Users}
        tone="violet"
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <AtribuicoesChart data={atribuicoes} />
        <StatusTarefasPie data={pieTarefas} />
      </div>

      {/* === PRODUTIVIDADE & BACKLOG === */}
      <SectionHeader
        title="Produtividade e backlog"
        description="Quanto a equipe entrega e como está o acúmulo de tarefas."
        icon={Gauge}
        tone="emerald"
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <VelocitySemanalCard tarefas={tarefas} />
        <ThroughputCard tarefas={tarefas} colaboradores={colaboradores.map((c) => ({ id: c.id, nome: c.nome }))} />
        <AgingBacklogCard tarefas={tarefas} />
      </div>

      {/* === QUALIDADE & FLUXO === */}
      <SectionHeader
        title="Qualidade e fluxo"
        description="Onde o processo trava ou perde qualidade."
        icon={ShieldCheck}
        tone="indigo"
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <TaxaReprovacaoCard tarefas={tarefas} />
        <CategoriaOrigemCard demandas={demandas} />
      </div>


      {/* === AGENDA & PESSOAS === */}
      <SectionHeader
        title="Agenda & pessoas"
        description="Compromissos da semana, férias e horários."
        icon={CalendarClock}
        tone="rose"
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <AtividadesSemanaPanel
          atividades={atividades}
          weekStart={weekStart}
          weekEnd={weekEnd}
          onPreview={openPreview}
          colaboradores={colaboradores.map((c) => ({ id: c.id, nome: c.nome }))}
          defaultColabId={meuColabId}
        />
        <EquipeAtivaPanel
          totalColaboradores={colaboradores.length}
          feriasAtivas={feriasAtivas}
          proximasFerias={proximasFerias}
        />
      </div>

      <HorariosPanel horarios={horarios} />


      <PreviewDialog item={preview} open={previewOpen} onOpenChange={setPreviewOpen} />
      <MinhasAtribuicoesDialog
        open={minhasOpen}
        onOpenChange={setMinhasOpen}
        nome={meuProfile?.nome ?? null}
        colabId={meuColabId}
        tarefas={tarefas}
        demandas={demandas}
        reunioes={reunioes}
        chamados={chamados}
        onOpenItem={(item) => {
          setMinhasOpen(false);
          openPreview(item);
        }}
      />
    </div>
  );
}
