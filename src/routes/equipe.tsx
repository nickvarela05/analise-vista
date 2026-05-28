import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  Users as UsersIcon,
  ShieldAlert,
  Briefcase,
  Coffee,
  Plane,
  AlertTriangle,
  LayoutList,
  CalendarDays,
  CalendarRange,
  Soup,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { EmptyState } from "@/components/EmptyState";
import { PageHero } from "@/components/shared/PageHero";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { qk } from "@/lib/queries/keys";
import { EquipeListaView } from "@/components/equipe/EquipeListaView";
import { EquipeGradeView } from "@/components/equipe/EquipeGradeView";
import { EquipeCalendarioView } from "@/components/equipe/EquipeCalendarioView";
import { ColaboradorDrawer } from "@/components/equipe/ColaboradorDrawer";
import { NovoColaboradorDialog } from "@/components/equipe/NovoColaboradorDialog";
import { EquipeUsuariosView } from "@/components/equipe/EquipeUsuariosView";
import { GestaoCopaView } from "@/components/equipe/GestaoCopaView";
import { computeStatus, ymdOf } from "@/components/equipe/lib/status";
import type { Colaborador } from "@/components/equipe/lib/types";

export const Route = createFileRoute("/equipe")({
  errorComponent: RouteErrorBoundary,
  component: EquipeRoute,
});

function EquipeRoute() {
  return (
    <AppLayout>
      <Equipe />
    </AppLayout>
  );
}

function Equipe() {
  const { role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = React.useState<Colaborador | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  React.useEffect(() => {
    if (!authLoading && role !== "gestor") {
      toast.error("Acesso restrito", { description: "Apenas gestores podem ver a Equipe." });
      navigate({ to: "/" });
    }
  }, [role, authLoading, navigate]);

  const { data: colabs = [], isLoading } = useQuery({
    queryKey: qk.equipe(),
    enabled: role === "gestor",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaborador")
        .select("*, colaborador_horario(*), colaborador_ferias(*), colaborador_evento(*)")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as unknown as Colaborador[];
    },
  });

  React.useEffect(() => {
    if (selected) {
      const fresh = colabs.find((c) => c.id === selected.id);
      if (fresh) setSelected(fresh);
    }
  }, [colabs, selected]);

  const kpis = React.useMemo(() => {
    const now = new Date();
    const startWeek = new Date(now);
    startWeek.setDate(now.getDate() - now.getDay());
    const endWeek = new Date(startWeek);
    endWeek.setDate(startWeek.getDate() + 6);
    const startISO = ymdOf(startWeek);
    const endISO = ymdOf(endWeek);

    let trabalhando = 0;
    let almoco = 0;
    let ferias = 0;
    let eventosSemana = 0;
    for (const c of colabs) {
      const s = computeStatus(c, now);
      if (s.key === "trabalhando") trabalhando++;
      else if (s.key === "almoco") almoco++;
      else if (s.key === "ferias") ferias++;
      for (const e of c.colaborador_evento ?? []) {
        if (e.data >= startISO && e.data <= endISO) eventosSemana++;
      }
    }
    return {
      total: colabs.length,
      trabalhando,
      almoco,
      ferias,
      eventosSemana,
    };
  }, [colabs]);

  if (authLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (role !== "gestor") {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Apenas gestores têm acesso à tela de Equipe."
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Gestão de pessoas"
        title="Equipe"
        description="Disponibilidade em tempo real, eventos diários, horários e férias."
        icon={UsersIcon}
        tone="cyan"
        actions={<NovoColaboradorDialog />}
        stats={[
          { icon: UsersIcon, label: "Ativos", value: kpis.total, tone: "cyan" },
          {
            icon: Briefcase,
            label: "Trabalhando",
            value: kpis.trabalhando,
            tone: "emerald",
            pulse: kpis.trabalhando > 0,
          },
          { icon: Coffee, label: "Em almoço", value: kpis.almoco, tone: "amber" },
          { icon: Plane, label: "Em férias", value: kpis.ferias, tone: "sky" },
          {
            icon: AlertTriangle,
            label: "Eventos/semana",
            value: kpis.eventosSemana,
            tone: "rose",
          },
        ]}
        statsGridClassName="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
      />

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : colabs.length === 0 ? (
        <EmptyState icon={UsersIcon} title="Nenhum colaborador cadastrado" />
      ) : (
        <Tabs defaultValue="lista" className="w-full">
          <TabsList className="bg-card/60 backdrop-blur ring-1 ring-border">
            <TabsTrigger
              value="lista"
              className="gap-1.5 data-[state=active]:text-cyan-600 dark:data-[state=active]:text-cyan-400"
            >
              <LayoutList className="h-3.5 w-3.5" /> Lista
            </TabsTrigger>
            <TabsTrigger
              value="grade"
              className="gap-1.5 data-[state=active]:text-cyan-600 dark:data-[state=active]:text-cyan-400"
            >
              <CalendarDays className="h-3.5 w-3.5" /> Grade semanal
            </TabsTrigger>
            <TabsTrigger
              value="calendario"
              className="gap-1.5 data-[state=active]:text-cyan-600 dark:data-[state=active]:text-cyan-400"
            >
              <CalendarRange className="h-3.5 w-3.5" /> Calendário
            </TabsTrigger>
            <TabsTrigger
              value="copa"
              className="gap-1.5 data-[state=active]:text-cyan-600 dark:data-[state=active]:text-cyan-400"
            >
              <Soup className="h-3.5 w-3.5" /> Copa
            </TabsTrigger>
            <TabsTrigger
              value="usuarios"
              className="gap-1.5 data-[state=active]:text-cyan-600 dark:data-[state=active]:text-cyan-400"
            >
              <Shield className="h-3.5 w-3.5" /> Usuários
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="mt-4">
            <EquipeListaView
              colabs={colabs}
              onSelect={(c) => {
                setSelected(c);
                setDrawerOpen(true);
              }}
            />
          </TabsContent>

          <TabsContent value="grade" className="mt-4">
            <EquipeGradeView colabs={colabs} />
          </TabsContent>

          <TabsContent value="calendario" className="mt-4">
            <EquipeCalendarioView colabs={colabs} />
          </TabsContent>

          <TabsContent value="copa" className="mt-4">
            <GestaoCopaView colabs={colabs} />
          </TabsContent>

          <TabsContent value="usuarios" className="mt-4">
            <EquipeUsuariosView colabs={colabs} />
          </TabsContent>
        </Tabs>
      )}

      <ColaboradorDrawer
        colab={selected}
        open={drawerOpen}
        onOpenChange={(v) => {
          setDrawerOpen(v);
          if (!v) setSelected(null);
        }}
      />
    </div>
  );
}
