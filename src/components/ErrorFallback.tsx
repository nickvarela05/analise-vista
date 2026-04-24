import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Link, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ErrorFallbackProps {
  error: Error;
  reset: () => void;
}

export function ErrorFallback({ error, reset }: ErrorFallbackProps) {
  const router = useRouter();

  const handleRetry = () => {
    void router.invalidate();
    reset();
  };

  const message = error?.message || "Erro desconhecido ao carregar a página.";
  const stack = error?.stack;

  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center p-4 sm:p-6">
      <Card className="w-full max-w-2xl border-destructive/30">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <CardTitle className="text-lg sm:text-xl">
              Algo deu errado ao carregar esta tela
            </CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Não foi possível renderizar o conteúdo. Você pode tentar recarregar
            esta rota ou voltar à tela inicial — o restante da aplicação
            continua funcionando.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Causa
            </p>
            <p className="mt-1 break-words text-sm font-medium text-foreground">
              {message}
            </p>
          </div>

          {stack && import.meta.env.DEV && (
            <details className="rounded-md border bg-muted/30 p-3">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Detalhes técnicos (dev)
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-muted-foreground">
                {stack}
              </pre>
            </details>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleRetry}>
              <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">
                <Home className="mr-2 h-4 w-4" /> Ir para o início
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
