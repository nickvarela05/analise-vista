import { createFileRoute } from "@tanstack/react-router";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { AppLayout } from "@/components/AppLayout";
import { CentralHomologacao } from "@/components/central/CentralHomologacao";

// Tela inicial: Central de Homologação desde 08/10/2026. O Dashboard antigo virou o
// Painel da gestão (/painel), enxuto.
export const Route = createFileRoute("/")({
  errorComponent: RouteErrorBoundary,
  component: IndexRoute,
});

function IndexRoute() {
  return (
    <AppLayout>
      <CentralHomologacao />
    </AppLayout>
  );
}
