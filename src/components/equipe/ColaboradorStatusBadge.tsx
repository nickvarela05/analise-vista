import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StatusKey } from "./lib/types";
import { STATUS_LABEL, EVENTO_LABEL } from "./lib/types";
import type { ComputedStatus } from "./lib/status";

const STYLES: Record<StatusKey, string> = {
  trabalhando: "border-transparent text-white",
  almoco: "border-transparent text-black/80",
  ferias: "border-transparent text-white",
  evento: "border-transparent text-white",
  fora: "border-transparent text-white",
};

const BG: Record<StatusKey, string> = {
  trabalhando: "bg-[var(--status-trabalhando)]",
  almoco: "bg-[var(--status-almoco)]",
  ferias: "bg-[var(--status-ferias)]",
  evento: "bg-[var(--status-evento)]",
  fora: "bg-[var(--status-fora)]",
};

export function ColaboradorStatusBadge({
  status,
  className,
}: {
  status: ComputedStatus;
  className?: string;
}) {
  const label =
    status.key === "evento" && status.eventoTipo
      ? EVENTO_LABEL[status.eventoTipo]
      : STATUS_LABEL[status.key];

  return (
    <Badge
      className={cn(
        "gap-1.5 px-2 py-0.5 text-[11px] font-medium",
        BG[status.key],
        STYLES[status.key],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-90" />
      {label}
      {status.key === "almoco" && status.detail && (
        <span className="opacity-80">· {status.detail}</span>
      )}
    </Badge>
  );
}
