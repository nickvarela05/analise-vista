import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Maximize, X } from "lucide-react";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { CentralHomologacao } from "@/components/central/CentralHomologacao";
import { PainelGestao } from "@/components/painel/PainelGestao";
import { cn } from "@/lib/utils";

/**
 * Modo TV (08/10/2026): substitui o antigo "Modo apresentação", que era uma cópia do Dashboard
 * e ficava desatualizada. Mostra as telas reais, alternando sozinho, e recarrega os dados
 * periodicamente. Endereço próprio para a TV abrir direto por favorito.
 */
export const Route = createFileRoute("/tv")({
  errorComponent: RouteErrorBoundary,
  component: TvRoute,
});

const TELAS = [
  { chave: "central", nome: "Central de Homologação" },
  { chave: "painel", nome: "Painel da gestão" },
] as const;
const TROCA_MS = 60_000;
const ATUALIZA_MS = 2 * 60_000;

function TvRoute() {
  return (
    <AppLayout bare>
      <ModoTv />
    </AppLayout>
  );
}

function ModoTv() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tela, setTela] = React.useState(0);
  const [agora, setAgora] = React.useState(() => new Date());

  // Alterna as telas; trocar à mão reinicia a contagem.
  React.useEffect(() => {
    const id = window.setInterval(() => setTela((i) => (i + 1) % TELAS.length), TROCA_MS);
    return () => window.clearInterval(id);
  }, [tela]);

  // Recarrega tudo de tempos em tempos (as tarefas também chegam pelo realtime).
  React.useEffect(() => {
    const id = window.setInterval(() => {
      qc.invalidateQueries();
      setAgora(new Date());
    }, ATUALIZA_MS);
    const relogio = window.setInterval(() => setAgora(new Date()), 30_000);
    return () => {
      window.clearInterval(id);
      window.clearInterval(relogio);
    };
  }, [qc]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setTela((i) => (i + 1) % TELAS.length);
      if (e.key === "ArrowLeft") setTela((i) => (i - 1 + TELAS.length) % TELAS.length);
      if (e.key === "Escape" && !document.fullscreenElement) navigate({ to: "/painel" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  const telaCheia = () => {
    document.documentElement.requestFullscreen?.().catch(() => {});
  };

  return (
    <div className="min-h-screen bg-muted/30 p-4 lg:p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold uppercase tracking-[0.22em]">Nexus</span>
          <nav className="flex items-center gap-1.5" aria-label="Telas">
            {TELAS.map((t, i) => (
              <button
                key={t.chave}
                type="button"
                onClick={() => setTela(i)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs transition-colors",
                  i === tela
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                {t.nome}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm tabular-nums text-muted-foreground">
            {agora.toLocaleString("pt-BR", {
              weekday: "short",
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={telaCheia}>
            <Maximize className="h-4 w-4" /> Tela cheia
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => navigate({ to: "/painel" })}
          >
            <X className="h-4 w-4" /> Sair
          </Button>
        </div>
      </header>
      {TELAS[tela].chave === "central" ? <CentralHomologacao tv /> : <PainelGestao tv />}
    </div>
  );
}
