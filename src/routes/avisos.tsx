import { createFileRoute } from "@tanstack/react-router";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Loader2,
  AlertTriangle,
  AlertCircle,
  Info,
  Bell,
  Search,
  Inbox,
  CheckCheck,
  Megaphone,
} from "lucide-react";
import {
  isToday,
  isYesterday,
  isThisWeek,
  isThisMonth,
  parseISO,
} from "date-fns";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { EmptyState } from "@/components/EmptyState";
import { PageHero } from "@/components/shared/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { qk } from "@/lib/queries/keys";
import { AvisoCard, type AvisoRow, type AvisoTipo } from "@/components/avisos/AvisoCard";
import { AvisoDialog } from "@/components/avisos/AvisoDialog";

export const Route = createFileRoute("/avisos")({
  errorComponent: RouteErrorBoundary,
  component: AvisosRoute,
});

function AvisosRoute() {
  return (
    <AppLayout>
      <Avisos />
    </AppLayout>
  );
}

type FiltroUrgencia = "todos" | AvisoTipo;
type FiltroEscopo = "todos" | "para_mim" | "nao_lidos";

function Avisos() {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const isGestor = role === "gestor";

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AvisoRow | null>(null);
  const [busca, setBusca] = React.useState("");
  const [urgencia, setUrgencia] = React.useState<FiltroUrgencia>("todos");
  const [escopo, setEscopo] = React.useState<FiltroEscopo>("todos");

  const { data: colabs = [] } = useQuery({
    queryKey: qk.avisos.colabs(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaborador")
        .select("id, nome, foto_url")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const colabsMap = React.useMemo(
    () =>
      new Map(
        colabs.map((c) => [c.id, { nome: c.nome, foto_url: c.foto_url ?? null }]),
      ),
    [colabs],
  );

  const { data: avisos = [], isLoading } = useQuery({
    queryKey: qk.avisos.all(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aviso_gestor")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AvisoRow[];
    },
  });

  const { data: leituras = [] } = useQuery({
    queryKey: qk.avisos.leiturasDoUsuario(user?.id),
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aviso_leitura")
        .select("aviso_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const lidos = React.useMemo(
    () => new Set(leituras.map((l) => l.aviso_id)),
    [leituras],
  );

  const { data: leiturasAgrupadas = [] } = useQuery({
    queryKey: qk.avisos.leiturasTodas(),
    enabled: isGestor,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aviso_leitura")
        .select("aviso_id, user_id");
      if (error) throw error;
      return data ?? [];
    },
  });

  const leiturasPorAviso = React.useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of leiturasAgrupadas) {
      if (!m.has(l.aviso_id)) m.set(l.aviso_id, new Set());
      m.get(l.aviso_id)!.add(l.user_id);
    }
    return m;
  }, [leiturasAgrupadas]);

  const isParaMim = React.useCallback(
    (a: AvisoRow) => {
      const ids = new Set<string>();
      if (a.colaborador_id) ids.add(a.colaborador_id);
      (a.colaboradores_ids ?? []).forEach((id) => ids.add(id));
      const meuColab = colabs.find(
        (c) => c.id && user && (c as any).email === user.email,
      );
      if (ids.size === 0) return true;
      if (meuColab && ids.has(meuColab.id)) return true;
      return false;
    },
    [colabs, user],
  );

  const filtrados = React.useMemo(() => {
    const now = Date.now();
    return avisos.filter((a) => {
      if (urgencia !== "todos" && a.tipo !== urgencia) return false;
      if (escopo === "nao_lidos" && (lidos.has(a.id) || !a.ativo)) return false;
      if (escopo === "para_mim" && !isParaMim(a)) return false;
      if (busca) {
        const q = busca.toLowerCase();
        if (
          !a.titulo.toLowerCase().includes(q) &&
          !a.mensagem.toLowerCase().includes(q)
        )
          return false;
      }
      if (!isGestor && !a.ativo) return false;
      if (!isGestor && a.expira_em && new Date(a.expira_em).getTime() < now)
        return false;
      return true;
    });
  }, [avisos, urgencia, escopo, lidos, busca, isGestor, isParaMim]);

  const kpis = React.useMemo(() => {
    const now = Date.now();
    const ativos = avisos.filter((a) => a.ativo);
    const criticos = ativos.filter((a) => a.tipo === "critico");
    const alertas = ativos.filter((a) => a.tipo === "alerta");
    const informativos = ativos.filter((a) => a.tipo === "informativo");
    const naoLidos = ativos.filter((a) => !lidos.has(a.id));
    const expirandoHoje = ativos.filter((a) => {
      if (!a.expira_em) return false;
      const t = new Date(a.expira_em).getTime();
      return t > now && t - now < 24 * 60 * 60 * 1000;
    });
    return {
      ativos: ativos.length,
      criticos: criticos.length,
      alertas: alertas.length,
      informativos: informativos.length,
      naoLidos: naoLidos.length,
      expirandoHoje: expirandoHoje.length,
    };
  }, [avisos, lidos]);

  const grupos = React.useMemo(() => {
    const buckets: Record<string, AvisoRow[]> = {
      Hoje: [],
      Ontem: [],
      "Esta semana": [],
      "Este mês": [],
      Anteriores: [],
    };
    const ordenados = [...filtrados].sort((a, b) => {
      const aDestaque = a.tipo === "critico" && a.ativo && !lidos.has(a.id) ? 1 : 0;
      const bDestaque = b.tipo === "critico" && b.ativo && !lidos.has(b.id) ? 1 : 0;
      if (aDestaque !== bDestaque) return bDestaque - aDestaque;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    for (const a of ordenados) {
      const d = parseISO(a.created_at);
      if (isToday(d)) buckets["Hoje"].push(a);
      else if (isYesterday(d)) buckets["Ontem"].push(a);
      else if (isThisWeek(d, { weekStartsOn: 1 })) buckets["Esta semana"].push(a);
      else if (isThisMonth(d)) buckets["Este mês"].push(a);
      else buckets["Anteriores"].push(a);
    }
    return buckets;
  }, [filtrados, lidos]);

  const marcarLido = async (avisoId: string, lido: boolean) => {
    if (!user) return;
    if (lido) {
      const { error } = await supabase
        .from("aviso_leitura")
        .insert({ aviso_id: avisoId, user_id: user.id });
      if (error && !error.message.includes("duplicate")) {
        toast.error("Erro", { description: error.message });
        return;
      }
    } else {
      const { error } = await supabase
        .from("aviso_leitura")
        .delete()
        .eq("aviso_id", avisoId)
        .eq("user_id", user.id);
      if (error) {
        toast.error("Erro", { description: error.message });
        return;
      }
    }
    qc.invalidateQueries({ queryKey: qk.avisos.leiturasPrefix() });
    qc.invalidateQueries({ queryKey: qk.avisos.bellLeituras() });
  };

  const marcarTodasLidas = async () => {
    if (!user) return;
    const naoLidos = filtrados.filter((a) => !lidos.has(a.id) && a.ativo);
    if (naoLidos.length === 0) {
      toast.info("Nada para marcar");
      return;
    }
    const rows = naoLidos.map((a) => ({ aviso_id: a.id, user_id: user.id }));
    const { error } = await supabase.from("aviso_leitura").upsert(rows, {
      onConflict: "aviso_id,user_id",
      ignoreDuplicates: true,
    });
    if (error) toast.error("Erro", { description: error.message });
    else {
      toast.success(`${naoLidos.length} aviso(s) marcado(s) como lidos`);
      qc.invalidateQueries({ queryKey: qk.avisos.leiturasPrefix() });
      qc.invalidateQueries({ queryKey: qk.avisos.bellLeituras() });
    }
  };

  const toggleAtivo = async (id: string, ativo: boolean) => {
    const { error } = await supabase.from("aviso_gestor").update({ ativo }).eq("id", id);
    if (error) toast.error("Erro", { description: error.message });
    else qc.invalidateQueries({ queryKey: qk.avisos.all() });
  };

  const remover = async (id: string) => {
    const { error } = await supabase.from("aviso_gestor").delete().eq("id", id);
    if (error) toast.error("Erro", { description: error.message });
    else {
      toast.success("Aviso removido");
      qc.invalidateQueries({ queryKey: qk.avisos.all() });
      qc.invalidateQueries({ queryKey: qk.avisos.bellAvisos() });
    }
  };

  const onSaved = () => {
    qc.invalidateQueries({ queryKey: qk.avisos.all() });
    qc.invalidateQueries({ queryKey: qk.avisos.bellAvisos() });
    qc.invalidateQueries({ queryKey: qk.dash.avisos() });
  };

  const totalDestinatarios = (a: AvisoRow) => {
    const ids = new Set<string>();
    if (a.colaborador_id) ids.add(a.colaborador_id);
    (a.colaboradores_ids ?? []).forEach((id) => ids.add(id));
    return ids.size === 0 ? colabs.length : ids.size;
  };

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Comunicação interna"
        title="Avisos"
        description="Comunicados internos com prioridade, destinatários e leitura confirmada."
        icon={Megaphone}
        tone="amber"
        actions={
          <>
            {user && (
              <Button variant="outline" size="sm" onClick={marcarTodasLidas}>
                <CheckCheck className="mr-2 h-4 w-4" />
                Marcar tudo como lido
              </Button>
            )}
            {isGestor && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
                className="bg-amber-500 text-white hover:bg-amber-600"
              >
                <Plus className="mr-2 h-4 w-4" /> Novo aviso
              </Button>
            )}
          </>
        }
        stats={[
          { icon: Bell, label: "Ativos", value: kpis.ativos, tone: "amber" },
          {
            icon: AlertTriangle,
            label: "Críticos",
            value: kpis.criticos,
            tone: "destructive",
            pulse: kpis.criticos > 0,
          },
          { icon: AlertCircle, label: "Alertas", value: kpis.alertas, tone: "amber" },
          { icon: Info, label: "Informativos", value: kpis.informativos, tone: "sky" },
          {
            icon: Inbox,
            label: "Não lidos",
            value: kpis.naoLidos,
            tone: "primary",
            pulse: kpis.naoLidos > 0,
          },
          {
            icon: AlertCircle,
            label: "Expiram 24h",
            value: kpis.expirandoHoje,
            tone: "rose",
          },
        ]}
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card/60 p-2 backdrop-blur sm:gap-3">
        <Tabs
          value={urgencia}
          onValueChange={(v) => setUrgencia(v as FiltroUrgencia)}
        >
          <TabsList className="bg-muted/60">
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="critico" className="gap-1 data-[state=active]:text-destructive">
              <AlertTriangle className="h-3 w-3" /> Críticos
            </TabsTrigger>
            <TabsTrigger value="alerta" className="gap-1 data-[state=active]:text-amber-600">
              <AlertCircle className="h-3 w-3" /> Alertas
            </TabsTrigger>
            <TabsTrigger value="informativo" className="gap-1 data-[state=active]:text-sky-600">
              <Info className="h-3 w-3" /> Informativos
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="hidden h-6 w-px bg-border sm:block" />

        <Tabs value={escopo} onValueChange={(v) => setEscopo(v as FiltroEscopo)}>
          <TabsList className="bg-muted/60">
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="nao_lidos">Não lidos</TabsTrigger>
            <TabsTrigger value="para_mim">Para mim</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:ml-auto sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar avisos..."
            className="h-9 pl-9"
          />
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtrados.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={
            avisos.length === 0
              ? "Nenhum aviso ainda"
              : "Nenhum aviso corresponde aos filtros"
          }
          description={
            avisos.length === 0 && isGestor
              ? "Publique o primeiro aviso para a equipe."
              : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(grupos).map(
            ([titulo, items]) =>
              items.length > 0 && (
                <section key={titulo}>
                  <h2 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <span className="h-px flex-none w-4 bg-gradient-to-r from-amber-500/50 to-transparent" />
                    {titulo}
                    <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-300">
                      {items.length}
                    </span>
                    <span className="h-px flex-1 bg-border/60" />
                  </h2>
                  <div className="space-y-2">
                    {items.map((a) => (
                      <AvisoCard
                        key={a.id}
                        aviso={a}
                        colabsMap={colabsMap}
                        isGestor={isGestor}
                        isLido={lidos.has(a.id)}
                        totalLeituras={leiturasPorAviso.get(a.id)?.size ?? 0}
                        totalDestinatarios={totalDestinatarios(a)}
                        onToggleLido={() => marcarLido(a.id, !lidos.has(a.id))}
                        onToggleAtivo={(v) => toggleAtivo(a.id, v)}
                        onEdit={() => {
                          setEditing(a);
                          setDialogOpen(true);
                        }}
                        onRemove={() => remover(a.id)}
                      />
                    ))}
                  </div>
                </section>
              ),
          )}
        </div>
      )}

      <AvisoDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditing(null);
        }}
        editing={editing}
        colabs={colabs}
        userId={user?.id}
        onSaved={onSaved}
      />
    </div>
  );
}
