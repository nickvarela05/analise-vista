import * as React from "react";
import { Loader2, Wand2, Upload, CheckCircle2, AlertCircle, X, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { useUploadStore, type UploadJob } from "@/lib/reuniao-upload-manager";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

const PHASE_LABEL: Record<UploadJob["phase"], string> = {
  compressing: "Otimizando áudio",
  uploading: "Enviando para o servidor",
  triggering: "Iniciando análise IA",
  done: "Análise iniciada",
  error: "Falha",
  canceled: "Cancelado",
};

const PHASE_ICON: Record<UploadJob["phase"], React.ReactNode> = {
  compressing: <Wand2 className="h-3.5 w-3.5 animate-pulse text-primary" />,
  uploading: <Upload className="h-3.5 w-3.5 animate-pulse text-primary" />,
  triggering: <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" />,
  done: <CheckCircle2 className="h-3.5 w-3.5 text-success" />,
  error: <AlertCircle className="h-3.5 w-3.5 text-destructive" />,
  canceled: <X className="h-3.5 w-3.5 text-muted-foreground" />,
};

export function BackgroundJobsIndicator() {
  const jobs = useUploadStore((s) => s.jobs);
  const cancel = useUploadStore((s) => s.cancel);
  const [expanded, setExpanded] = React.useState(true);

  const list = Object.values(jobs);

  // Avisa antes de fechar a aba se houver jobs em andamento
  React.useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const active = list.some(
        (j) => j.phase === "compressing" || j.phase === "uploading",
      );
      if (active) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [list]);

  if (list.length === 0) return null;

  const activeCount = list.filter(
    (j) => j.phase !== "done" && j.phase !== "error" && j.phase !== "canceled",
  ).length;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 w-[min(360px,calc(100vw-2rem))]">
      <div className="pointer-events-auto overflow-hidden rounded-lg border bg-background shadow-lg">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2 text-sm font-medium hover:bg-muted/60"
        >
          <span className="flex items-center gap-2">
            {activeCount > 0 ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            )}
            {activeCount > 0
              ? `Processando ${activeCount} reunião${activeCount > 1 ? "ões" : ""}`
              : `${list.length} concluído${list.length > 1 ? "s" : ""}`}
          </span>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {expanded && (
          <div className="max-h-[60vh] divide-y overflow-y-auto">
            {list.map((job) => (
              <div key={job.reuniaoId} className="space-y-1.5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{job.titulo}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      {PHASE_ICON[job.phase]}
                      <span>{PHASE_LABEL[job.phase]}</span>
                      {(job.phase === "compressing" || job.phase === "uploading") && (
                        <span>· {job.progress}%</span>
                      )}
                    </p>
                  </div>
                  {(job.phase === "compressing" || job.phase === "uploading") && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => cancel(job.reuniaoId)}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
                {(job.phase === "compressing" || job.phase === "uploading") && (
                  <Progress value={job.progress} className="h-1.5" />
                )}
                {job.phase === "error" && job.errorMsg && (
                  <p className="text-[11px] text-destructive">{job.errorMsg}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
