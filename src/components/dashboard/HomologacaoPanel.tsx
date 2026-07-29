import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Hammer,
  Users,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TarefaRow } from "@/lib/db-types";

type Colab = { id: string; nome: string };

const TONE = {
  info: {
    ring: "ring-info/30",
    bg: "from-info/15 via-card to-card",
    text: "text-info",
    chip: "bg-info/15 text-info",
    bar: "bg-info",
  },
  success: {
    ring: "ring-success/30",
    bg: "from-success/15 via-card to-card",
    text: "text-success",
    chip: "bg-success/15 text-success",
    bar: "bg-success",
  },
  warning: {
    ring: "ring-warning/40",
    bg: "from-warning/15 via-card to-card",
    text: "text-warning",
    chip: "bg-warning/20 text-warning",
    bar: "bg-warning",
  },
  destructive: {
    ring: "ring-destructive/30",
    bg: "from-destructive/15 via-card to-card",
    text: "text-destructive",
    chip: "bg-destructive/15 text-destructive",
    bar: "bg-destructive",
  },
  primary: {
    ring: "ring-primary/30",
    bg: "from-primary/15 via-card to-card",
    text: "text-primary",
    chip: "bg-primary/15 text-primary",
    bar: "bg-primary",
  },
} as const;

type ToneKey = keyof typeof TONE;

function matchesResponsavel(t: TarefaRow, filtro: string) {
  if (filtro === "__all__") return true;
  if (filtro === "__equipe__") return !!t.equipe_toda;
  return (t.responsaveis_ids ?? []).includes(filtro) || !!t.equipe_toda;
}

export function HomologacaoPanel({
  tarefas,
  colaboradores,
}: {
  tarefas: TarefaRow[];
  colaboradores: Colab[];
}) {
  const [filtro, setFiltro] = React.useState("__all__");

  const base = React.useMemo(
    () => tarefas.filter((t) => matchesResponsavel(t, filtro)),
    [tarefas, filtro],
  );

  const grupos = React.useMemo(() => {
    const emTesteHml = base.filter((t) => t.status === "homologacao" && t.em_teste);
    const hmlSemTeste = base.filter((t) => t.status === "homologacao" && !t.em_teste);
    const preBuild = base.filter((t) => t.status === "pre_build");
    const aprovadas = base.filter((t) => t.status === "aprovado");
    const ressalvas = base.filter((t) => t.status === "aprovado_ressalvas");
    const reprovadas = base.filter((t) => t.status === "reprovado");
    return { emTesteHml, hmlSemTeste, preBuild, aprovadas, ressalvas, reprovadas };
  }, [base]);

  const cards: {
    key: string;
    label: string;
    hint: string;
    value: number;
    tone: ToneKey;
    icon: React.ComponentType<{ className?: string }>;
    itens: TarefaRow[];
  }[] = [
    {
      key: "teste",
      label: "Em teste (HML)",
      hint: "Homologação marcada como em teste",
      value: grupos.emTesteHml.length,
      tone: "info",
      icon: FlaskConical,
      itens: grupos.emTesteHml,
    },
    {
      key: "prebuild",
      label: "Pré-build",
      hint: "Preparação para build",
      value: grupos.preBuild.length,
      tone: "primary",
      icon: Hammer,
      itens: grupos.preBuild,
    },
    {
      key: "aprov",
      label: "Aprovadas",
      hint: "Liberadas para produção",
      value: grupos.aprovadas.length,
      tone: "success",
      icon: CheckCircle2,
      itens: grupos.aprovadas,
    },
    {
      key: "ressalva",
      label: "Aprov. c/ ressalvas",
      hint: "Aprovadas com pendências",
      value: grupos.ressalvas.length,
      tone: "warning",
      icon: AlertTriangle,
      itens: grupos.ressalvas,
    },
    {
      key: "reprov",
      label: "Reprovadas",
      hint: "Necessitam ajustes",
      value: grupos.reprovadas.length,
      tone: "destructive",
      icon: XCircle,
      itens: grupos.reprovadas,
    },
  ];

  const totalCiclo = cards.reduce((a, c) => a + c.value, 0);
  const validadas = grupos.aprovadas.length + grupos.ressalvas.length;
  const avaliadas = validadas + grupos.reprovadas.length;
  const taxaAprovacao = avaliadas === 0 ? null : Math.round((validadas / avaliadas) * 100);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Barra de filtro + resumo */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border/60 bg-card/70 px-3 py-2 backdrop-blur sm:flex sm:justify-between sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-info/10 text-info ring-1 ring-info/25">
            <FlaskConical className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold leading-tight">Ciclo de homologação</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {totalCiclo} tarefas no ciclo
              {taxaAprovacao !== null && ` · ${taxaAprovacao}% de aprovação`}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Select value={filtro} onValueChange={setFiltro}>
            <SelectTrigger className="h-9 w-[190px] text-xs">
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="__all__">Todos</SelectItem>
              <SelectItem value="__equipe__">Equipe toda</SelectItem>
              {colaboradores.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Link
            to="/tarefas"
            className="hidden items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/20 sm:flex"
          >
            Abrir <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Cards + listas */}
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {cards.map((c) => {
          const tone = TONE[c.tone];
          const Icon = c.icon;
          const pct = totalCiclo === 0 ? 0 : Math.round((c.value / totalCiclo) * 100);
          return (
            <div
              key={c.key}
              className={cn(
                "relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br p-3 shadow-sm ring-1 backdrop-blur",
                tone.bg,
                tone.ring,
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-xl", tone.chip)}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className={cn("text-3xl font-bold tabular-nums leading-none", tone.text)}>
                  {c.value}
                </span>
              </div>
              <div className="mt-2 truncate text-xs font-semibold">{c.label}</div>
              <div className="truncate text-[10px] text-muted-foreground">{c.hint}</div>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted/50">
                <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${pct}%` }} />
              </div>
              <ul className="mt-2 min-h-0 flex-1 space-y-1 overflow-auto pr-0.5">
                {c.itens.length === 0 ? (
                  <li className="text-[10px] text-muted-foreground">Nenhuma tarefa.</li>
                ) : (
                  c.itens.slice(0, 12).map((t) => (
                    <li
                      key={t.id}
                      className="truncate rounded-md bg-background/50 px-1.5 py-1 text-[10px] leading-tight"
                      title={t.titulo}
                    >
                      {t.titulo}
                    </li>
                  ))
                )}
                {c.itens.length > 12 && (
                  <li className="text-[10px] font-semibold text-muted-foreground">
                    +{c.itens.length - 12} outras
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Rodapé: homologação sem teste */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border/60 bg-card/60 px-3 py-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          Filtro:{" "}
          <strong className="text-foreground">
            {filtro === "__all__"
              ? "Todos"
              : filtro === "__equipe__"
                ? "Equipe toda"
                : (colaboradores.find((c) => c.id === filtro)?.nome ?? "—")}
          </strong>
        </span>
        <span>
          Em homologação sem marcação de teste:{" "}
          <strong className="text-foreground tabular-nums">{grupos.hmlSemTeste.length}</strong>
        </span>
        <span>
          Total em homologação:{" "}
          <strong className="text-foreground tabular-nums">
            {grupos.hmlSemTeste.length + grupos.emTesteHml.length}
          </strong>
        </span>
      </div>
    </div>
  );
}
