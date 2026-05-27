import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles, Loader2, AlertCircle, Calendar, RefreshCw,
  TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, Flame, Lightbulb,
  ListChecks, Inbox, Clock, Target, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/insights")({
  component: () => (
    <AppLayout>
      <InsightsPage />
    </AppLayout>
  ),
});

function InsightsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Insights & IA"
        description="Resumos executivos gerados por IA para sua semana."
      />
      <ResumoSemanal />
    </div>
  );
}

function ResumoSemanal() {
  const { role } = useAuth();
  const [resumos, setResumos] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [gerando, setGerando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    setErro(null);
    const { data, error } = await supabase
      .from("resumo_semanal")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) {
      setErro(error.message);
      setResumos([]);
      setLoading(false);
      return;
    }
    setResumos(data ?? []);
    setLoading(false);
  }

  React.useEffect(() => { carregar(); }, []);

  async function gerarAgora() {
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-resumo-semanal");
      if (error) throw error;
      if ((data?.gerados ?? 0) > 0) {
        toast.success("Resumo gerado", { description: `${data.gerados} resumo${data.gerados === 1 ? "" : "s"} atualizado${data.gerados === 1 ? "" : "s"}.` });
      } else {
        toast.info("Nenhum resumo novo", { description: "Não foram encontradas atividades na semana anterior para resumir." });
      }
      await carregar();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/15 p-2.5 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Resumos executivos com IA</CardTitle>
              <CardDescription className="mt-1">
                Sua semana, condensada em decisões. Gerado toda segunda-feira às 7h.
              </CardDescription>
            </div>
          </div>
          {role === "gestor" && (
            <Button size="sm" onClick={gerarAgora} disabled={gerando} className="shrink-0">
              {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {gerando ? "Gerando…" : "Gerar agora"}
            </Button>
          )}
        </CardHeader>
      </Card>

      {loading ? (
        <Card><CardContent className="p-6"><div className="flex items-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando resumos…</div></CardContent></Card>
      ) : erro ? (
        <Card><CardContent className="p-6"><div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{erro}</span></div></CardContent></Card>
      ) : resumos.length === 0 ? (
        <Card><CardContent className="p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Sparkles className="h-6 w-6" /></div>
          <p className="text-sm font-medium">Nenhum resumo ainda</p>
          <p className="mt-1 text-xs text-muted-foreground">{role === "gestor" ? "Clique em \"Gerar agora\" para criar o primeiro." : "O resumo será gerado automaticamente na próxima segunda-feira."}</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-6">
          {resumos.map((r, idx) => <ResumoCard key={r.id} resumo={r} destaque={idx === 0} />)}
        </div>
      )}
    </div>
  );
}

const METRIC_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string; ring: string }> = {
  tarefas_total:           { label: "Tarefas criadas",   icon: ListChecks,  tone: "text-sky-600 dark:text-sky-400",       ring: "from-sky-500/20 to-transparent" },
  tarefas_concluidas:      { label: "Concluídas",        icon: CheckCircle2,tone: "text-emerald-600 dark:text-emerald-400", ring: "from-emerald-500/20 to-transparent" },
  tarefas_urgentes:        { label: "Urgentes",          icon: Flame,       tone: "text-orange-600 dark:text-orange-400", ring: "from-orange-500/20 to-transparent" },
  demandas_total:          { label: "Demandas novas",    icon: Inbox,       tone: "text-violet-600 dark:text-violet-400", ring: "from-violet-500/20 to-transparent" },
  demandas_em_andamento:   { label: "Em andamento",      icon: Clock,       tone: "text-indigo-600 dark:text-indigo-400", ring: "from-indigo-500/20 to-transparent" },
  chamados_total:          { label: "Chamados",          icon: Target,      tone: "text-cyan-600 dark:text-cyan-400",     ring: "from-cyan-500/20 to-transparent" },
  chamados_sla_estourado:  { label: "SLA estourado",     icon: AlertTriangle, tone: "text-red-600 dark:text-red-400",     ring: "from-red-500/20 to-transparent" },
};

function ResumoCard({ resumo: r, destaque }: { resumo: any; destaque?: boolean }) {
  const metricas = (r.metricas ?? {}) as Record<string, number>;
  const taxaConclusao = metricas.tarefas_total > 0
    ? Math.round((metricas.tarefas_concluidas / metricas.tarefas_total) * 100)
    : null;

  const sections = parseMarkdownSections(r.conteudo_md ?? "");

  return (
    <Card className={cn("overflow-hidden", destaque && "ring-1 ring-primary/20 shadow-lg")}>
      {/* Header gradient */}
      <div className="relative border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
              <Calendar className="h-3 w-3" />
              {new Date(r.semana_inicio).toLocaleDateString("pt-BR")} – {new Date(r.semana_fim).toLocaleDateString("pt-BR")}
            </span>
            {destaque && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <Sparkles className="h-3 w-3" /> Mais recente
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            Atualizado em {new Date(r.created_at).toLocaleString("pt-BR")}
          </span>
        </div>

        {taxaConclusao !== null && (
          <div className="mt-4 flex items-center gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight">{taxaConclusao}%</span>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">conclusão</span>
            </div>
            <div className="ml-2 inline-flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium">
              {taxaConclusao >= 70 ? (
                <><TrendingUp className="h-3 w-3 text-emerald-500" /><span className="text-emerald-700 dark:text-emerald-400">Acima da meta</span></>
              ) : taxaConclusao >= 40 ? (
                <><TrendingUp className="h-3 w-3 text-amber-500" /><span className="text-amber-700 dark:text-amber-400">No ritmo</span></>
              ) : (
                <><TrendingDown className="h-3 w-3 text-red-500" /><span className="text-red-700 dark:text-red-400">Atenção</span></>
              )}
            </div>
          </div>
        )}
      </div>

      <CardContent className="space-y-6 p-6">
        {/* KPIs */}
        {Object.keys(metricas).length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Object.entries(METRIC_META).map(([key, meta]) => {
              if (metricas[key] === undefined) return null;
              const Icon = meta.icon;
              return (
                <div key={key} className={cn("relative overflow-hidden rounded-xl border bg-card p-3.5 transition-all hover:shadow-md")}>
                  <div className={cn("absolute inset-0 bg-gradient-to-br opacity-60", meta.ring)} />
                  <div className="relative">
                    <Icon className={cn("h-4 w-4", meta.tone)} />
                    <div className="mt-2 text-2xl font-bold tabular-nums">{metricas[key]}</div>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{meta.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Conteúdo seccionado */}
        {sections.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {sections.map((s, i) => (
              <SectionBlock key={i} section={s} />
            ))}
          </div>
        )}

        {/* Insights destacados */}
        {r.insights && r.insights.length > 0 && (
          <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-4">
            <div className="mb-3 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold">Principais insights</h4>
            </div>
            <ul className="space-y-2">
              {r.insights.map((it: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="text-foreground/90">{it}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type MdSection = { title: string; tone: "destaque" | "atencao" | "recomendacao" | "default"; items: string[]; paragraphs: string[] };

function parseMarkdownSections(md: string): MdSection[] {
  if (!md) return [];
  const lines = md.split("\n");
  const sections: MdSection[] = [];
  let cur: MdSection | null = null;
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^#{1,4}\s+(.+)$/);
    if (h) {
      if (cur) sections.push(cur);
      const title = h[1].replace(/[*_`]/g, "").trim();
      const low = title.toLowerCase();
      const tone: MdSection["tone"] =
        /(destaque|conquista|highlight|win)/.test(low) ? "destaque" :
        /(aten|risc|alerta|atras|bloque)/.test(low) ? "atencao" :
        /(recomend|próxim|sugest|ação|action)/.test(low) ? "recomendacao" : "default";
      cur = { title, tone, items: [], paragraphs: [] };
      continue;
    }
    if (!cur) cur = { title: "Resumo", tone: "default", items: [], paragraphs: [] };
    const bullet = line.match(/^\s*[-*•]\s+(.+)$/);
    if (bullet) {
      cur.items.push(bullet[1].trim());
    } else if (line.trim()) {
      cur.paragraphs.push(line.trim());
    }
  }
  if (cur) sections.push(cur);
  return sections.filter((s) => s.items.length || s.paragraphs.length);
}

function SectionBlock({ section }: { section: MdSection }) {
  const palette = {
    destaque:      { icon: TrendingUp,    cls: "border-emerald-500/30 bg-emerald-500/5", iconCls: "text-emerald-600 dark:text-emerald-400" },
    atencao:       { icon: AlertTriangle, cls: "border-amber-500/30 bg-amber-500/5",     iconCls: "text-amber-600 dark:text-amber-400" },
    recomendacao:  { icon: Target,        cls: "border-primary/30 bg-primary/5",         iconCls: "text-primary" },
    default:       { icon: Sparkles,      cls: "border-border bg-muted/30",              iconCls: "text-muted-foreground" },
  }[section.tone];
  const Icon = palette.icon;

  return (
    <div className={cn("rounded-xl border p-4", palette.cls)}>
      <div className="mb-2 flex items-center gap-2">
        <Icon className={cn("h-4 w-4", palette.iconCls)} />
        <h4 className="text-sm font-semibold leading-none">{section.title}</h4>
      </div>
      {section.paragraphs.map((p, i) => (
        <p key={i} className="mb-2 text-sm leading-relaxed text-foreground/85">{renderInline(p)}</p>
      ))}
      {section.items.length > 0 && (
        <ul className="space-y-1.5">
          {section.items.map((it, i) => (
            <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-foreground/85">
              <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", palette.iconCls.replace("text-", "bg-"))} />
              <span>{renderInline(it)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  // **bold** parsing
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    /^\*\*[^*]+\*\*$/.test(p)
      ? <strong key={i} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>
      : <React.Fragment key={i}>{p}</React.Fragment>
  );
}
