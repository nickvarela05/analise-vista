import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Check,
  Pencil,
  Trash2,
  Users,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type AvisoTipo = "informativo" | "alerta" | "critico";

export interface AvisoRow {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: AvisoTipo;
  ativo: boolean;
  created_at: string;
  expira_em: string | null;
  colaborador_id: string | null;
  colaboradores_ids: string[] | null;
}

interface AvisoCardProps {
  aviso: AvisoRow;
  colabsMap: Map<string, { nome: string; foto_url: string | null }>;
  isGestor: boolean;
  isLido: boolean;
  totalLeituras?: number;
  totalDestinatarios?: number;
  onToggleLido: () => void;
  onToggleAtivo: (v: boolean) => void;
  onEdit: () => void;
  onRemove: () => void;
}

const tipoConfig = {
  critico: {
    label: "Crítico",
    Icon: AlertTriangle,
    bar: "bg-destructive",
    badge: "border-destructive/40 bg-destructive/10 text-destructive",
    iconBg: "bg-destructive/10 text-destructive",
    pulse: true,
  },
  alerta: {
    label: "Alerta",
    Icon: AlertCircle,
    bar: "bg-amber-500",
    badge: "border-amber-500/40 bg-amber-500/10 text-amber-600",
    iconBg: "bg-amber-500/10 text-amber-600",
    pulse: false,
  },
  informativo: {
    label: "Informativo",
    Icon: Info,
    bar: "bg-sky-500",
    badge: "border-sky-500/40 bg-sky-500/10 text-sky-600",
    iconBg: "bg-sky-500/10 text-sky-600",
    pulse: false,
  },
} as const;

export function AvisoCard({
  aviso,
  colabsMap,
  isGestor,
  isLido,
  totalLeituras,
  totalDestinatarios,
  onToggleLido,
  onToggleAtivo,
  onEdit,
  onRemove,
}: AvisoCardProps) {
  const cfg = tipoConfig[aviso.tipo];
  const Icon = cfg.Icon;

  const destinatarios = React.useMemo(() => {
    const ids = new Set<string>();
    if (aviso.colaborador_id) ids.add(aviso.colaborador_id);
    (aviso.colaboradores_ids ?? []).forEach((id) => ids.add(id));
    return Array.from(ids)
      .map((id) => colabsMap.get(id))
      .filter(Boolean) as { nome: string; foto_url: string | null }[];
  }, [aviso, colabsMap]);

  const isParaTodos = destinatarios.length === 0;

  const expiraEm = aviso.expira_em ? new Date(aviso.expira_em) : null;
  const expirado = expiraEm ? expiraEm.getTime() < Date.now() : false;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-card transition-all",
        !aviso.ativo && "opacity-60",
        isLido && "border-border/60",
        !isLido && "border-border shadow-sm",
      )}
    >
      {/* Barra lateral de cor por urgência */}
      <div className={cn("absolute inset-y-0 left-0 w-1", cfg.bar)} />

      <div className="flex items-start gap-3 pl-4 pr-3 py-3">
        {/* Ícone */}
        <div
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            cfg.iconBg,
            cfg.pulse && aviso.ativo && !isLido && "animate-pulse",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>

        {/* Conteúdo */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cn("text-[10px]", cfg.badge)}>
              {cfg.label}
            </Badge>
            {!isLido && aviso.ativo && (
              <span className="inline-flex h-2 w-2 rounded-full bg-primary" aria-label="Não lida" />
            )}
            {!aviso.ativo && (
              <Badge variant="secondary" className="text-[10px]">
                Inativo
              </Badge>
            )}
            {expirado && (
              <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                Expirado
              </Badge>
            )}
          </div>

          <h3
            className={cn(
              "mt-1.5 truncate text-sm",
              isLido ? "font-medium text-foreground/90" : "font-semibold text-foreground",
            )}
          >
            {aviso.titulo}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{aviso.mensagem}</p>

          {/* Meta */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(aviso.created_at), {
                addSuffix: true,
                locale: ptBR,
              })}
            </span>

            {expiraEm && !expirado && (
              <span className="inline-flex items-center gap-1">
                · Expira{" "}
                {formatDistanceToNow(expiraEm, { addSuffix: true, locale: ptBR })}
              </span>
            )}

            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {isParaTodos
                ? "Equipe toda"
                : destinatarios.length === 1
                  ? destinatarios[0].nome
                  : `${destinatarios.length} colaboradores`}
            </span>

            {isGestor && totalDestinatarios !== undefined && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 cursor-help">
                      <Check className="h-3 w-3" />
                      {totalLeituras ?? 0}/{totalDestinatarios} leram
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Confirmações de leitura
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        {/* Ações */}
        <div className="flex shrink-0 items-center gap-1">
          {!isGestor && aviso.ativo && (
            <Button
              variant={isLido ? "ghost" : "outline"}
              size="sm"
              onClick={onToggleLido}
              className="h-8 gap-1 text-xs"
            >
              <Check className="h-3.5 w-3.5" />
              {isLido ? "Lida" : "Marcar como lida"}
            </Button>
          )}

          {isGestor && (
            <>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center">
                      <Switch
                        checked={aviso.ativo}
                        onCheckedChange={onToggleAtivo}
                        aria-label="Ativar/desativar aviso"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {aviso.ativo ? "Desativar" : "Ativar"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onEdit}
                aria-label="Editar"
              >
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir aviso?</AlertDialogTitle>
                    <AlertDialogDescription>
                      O aviso "{aviso.titulo}" será removido permanentemente, junto com
                      o histórico de leituras.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onRemove}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
