import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Users as UsersIcon, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { qk } from "@/lib/queries/keys";
import { EquipeKpis } from "@/components/equipe/EquipeKpis";
import { EquipeListaView } from "@/components/equipe/EquipeListaView";
import { EquipeGradeView } from "@/components/equipe/EquipeGradeView";
import { EquipeCalendarioView } from "@/components/equipe/EquipeCalendarioView";
import { ColaboradorDrawer } from "@/components/equipe/ColaboradorDrawer";
import { NovoColaboradorDialog } from "@/components/equipe/NovoColaboradorDialog";
import { EquipeUsuariosView } from "@/components/equipe/EquipeUsuariosView";
import { GestaoCopaView } from "@/components/equipe/GestaoCopaView";
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

  // Mantém o "selected" sincronizado com a query quando re-fetch acontece
  React.useEffect(() => {
    if (selected) {
      const fresh = colabs.find((c) => c.id === selected.id);
      if (fresh) setSelected(fresh);
    }
  }, [colabs, selected]);

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
    <div>
      <PageHeader
        title="Equipe"
        description="Disponibilidade em tempo real, eventos diários, horários e férias."
        actions={<NovoColaboradorDialog />}
      />

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : colabs.length === 0 ? (
        <EmptyState icon={UsersIcon} title="Nenhum colaborador cadastrado" />
      ) : (
        <>
          <EquipeKpis colabs={colabs} />

          <Tabs defaultValue="lista" className="w-full">
            <TabsList>
              <TabsTrigger value="lista">Lista</TabsTrigger>
              <TabsTrigger value="grade">Grade semanal</TabsTrigger>
              <TabsTrigger value="calendario">Calendário mensal</TabsTrigger>
              <TabsTrigger value="copa">Gestão de copa</TabsTrigger>
              <TabsTrigger value="usuarios">Usuários</TabsTrigger>
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
        </>
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
