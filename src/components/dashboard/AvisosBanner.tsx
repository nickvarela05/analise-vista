import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AvisoRow } from "@/lib/db-types";
import type { PreviewItem } from "@/components/PreviewDialog";

interface Props {
  avisos: AvisoRow[];
  onPreview: (item: PreviewItem) => void;
}

export function AvisosBanner({ avisos, onPreview }: Props) {
  if (avisos.length === 0) return null;
  return (
    <div className="space-y-2">
      {avisos.slice(0, 2).map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() =>
            onPreview({
              id: a.id,
              tipo: "aviso",
              titulo: a.titulo,
              descricao: a.mensagem,
              status: a.tipo,
              data: a.created_at,
              dataLabel: "Publicado",
            })
          }
          className={cn(
            "alert-banner w-full text-left",
            a.tipo === "critico"
              ? "alert-banner-critico"
              : a.tipo === "alerta"
                ? "alert-banner-alerta"
                : "alert-banner-informativo",
          )}
        >
          <AlertTriangle
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0",
              a.tipo === "critico"
                ? "text-destructive"
                : a.tipo === "alerta"
                  ? "text-warning"
                  : "text-info",
            )}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-tight">{a.titulo}</p>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{a.mensagem}</p>
          </div>
          <Badge variant="outline" className="text-[10px] uppercase shrink-0">
            {a.tipo}
          </Badge>
        </button>
      ))}
    </div>
  );
}
