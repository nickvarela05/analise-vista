import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { inspectN8nDbSchema } from "@/server/n8n-db.functions";

export const Route = createFileRoute("/_inspect-n8n")({
  component: InspectRoute,
});

function InspectRoute() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["inspect-n8n"],
    queryFn: () => inspectN8nDbSchema(),
  });

  return (
    <AppLayout>
      <PageHeader
        title="Inspeção: Banco N8N - Relatórios"
        description="Schema do banco externo (apenas para análise)."
      />
      {isLoading && (
        <Card className="p-6 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Inspecionando...
        </Card>
      )}
      {error && (
        <Card className="p-6 text-destructive">{(error as Error).message}</Card>
      )}
      {data && (
        <Card className="p-6 space-y-4">
          <pre className="text-xs overflow-auto max-h-[600px] bg-muted p-4 rounded">
            {JSON.stringify(data, null, 2)}
          </pre>
        </Card>
      )}
    </AppLayout>
  );
}
