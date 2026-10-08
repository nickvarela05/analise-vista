import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { AppLayout } from "@/components/AppLayout";
import { PainelGestao } from "@/components/painel/PainelGestao";

export const Route = createFileRoute("/painel")({
  errorComponent: RouteErrorBoundary,
  component: PainelRoute,
});

function PainelRoute() {
  const navigate = useNavigate();
  return (
    <AppLayout>
      <PainelGestao onModoTv={() => navigate({ to: "/tv" })} />
    </AppLayout>
  );
}
