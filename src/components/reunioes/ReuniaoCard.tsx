import {
  Calendar as CalIcon,
  Users,
  FileText,
  MoreVertical,
  Pencil,
  Trash2,
  ExternalLink,
  Clock,
  Sparkles,
  CheckCheck,
} from "lucide-react";
import { format, isFuture } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AssigneeCombobox, AssigneeBadges } from "@/components/AssigneeCombobox";
import type { UploadJob } from "@/lib/reuniao-upload-manager";
import type { AssigneeOption } from "@/components/AssigneeCombobox";
import { REUNIAO_TONE, type ReuniaoLista } from "@/components/reunioes/reunioes-lib";

/** Card de uma reunião na lista. */
export function ReuniaoCard({
  r,
  job,
  colabs,
  onAbrir,
  onEditar,
  onExcluir,
  onAtribuir,
}: {
  r: ReuniaoLista;
  job: UploadJob | undefined;
  colabs: AssigneeOption[];
  onAbrir: (r: ReuniaoLista) => void;
  onEditar: (r: ReuniaoLista) => void;
  onExcluir: (r: ReuniaoLista) => void;
  onAtribuir: (id: string, next: { selectedIds: string[]; equipeToda: boolean }) => void;
}) {
  const tone = REUNIAO_TONE[r.status] ?? REUNIAO_TONE.agendada;
  const isFuturo = r.status === "agendada" && isFuture(new Date(r.data_reuniao));
  const hasIA = !!(r.temTranscricao && r.resumo);
  const jobActive =
    job && (job.phase === "compressing" || job.phase === "uploading" || job.phase === "triggering");
  const isProcessing = jobActive || r.transcricao_status === "processando";
  const phaseLabel = jobActive
    ? job!.phase === "compressing"
      ? `otimizando ${job!.progress}%`
      : job!.phase === "uploading"
        ? `enviando ${job!.progress}%`
        : "iniciando IA"
    : "transcrevendo";
  return (
    <div
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-xl border bg-card shadow-sm transition-all",
        "hover:-translate-y-0.5 hover:shadow-lg hover:border-foreground/15",
        isProcessing && "reuniao-processing",
      )}
      onClick={() => onAbrir(r)}
    >
      {/* top accent strip — substituído por barra animada quando processando */}
      {isProcessing ? (
        <span aria-hidden className="reuniao-processing-bar" />
      ) : (
        <span aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5", tone.accent)} />
      )}
      {/* hover wash */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-primary/[0.03] opacity-0 transition-opacity group-hover:opacity-100"
      />

      <div className="relative p-4 pt-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold leading-snug text-foreground">
              {r.titulo}
            </h3>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalIcon className="h-3 w-3" />
                {format(new Date(r.data_reuniao), "dd 'de' MMM 'às' HH:mm", {
                  locale: ptBR,
                })}
              </span>
              {r.duracao_min ? (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {r.duracao_min}min
                  </span>
                </>
              ) : null}
              {isFuturo && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-1.5 py-0.5 font-medium text-sky-700 dark:text-sky-300">
                  futura
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex flex-col items-end gap-1">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                  tone.statusBadge,
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
                {r.status}
              </span>
              <Badge variant="outline" className="capitalize text-[10px] text-muted-foreground">
                {r.tipo}
              </Badge>
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onAbrir(r)}>
                    <ExternalLink className="mr-2 h-4 w-4" /> Visualizar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEditar(r)}>
                    <Pencil className="mr-2 h-4 w-4" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onExcluir(r)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* IA Resumo destacado */}
        {r.resumo && (
          <div
            className={cn(
              "rounded-lg border p-2.5 text-xs leading-relaxed",
              hasIA
                ? "border-primary/20 bg-primary/5 text-foreground/80"
                : "border-border/50 bg-muted/40 text-muted-foreground",
            )}
          >
            {hasIA && (
              <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                <Sparkles className="h-3 w-3" />
                Resumo IA
              </div>
            )}
            <p className="line-clamp-3">{r.resumo}</p>
          </div>
        )}

        <div onClick={(e) => e.stopPropagation()}>
          <AssigneeBadges
            selectedIds={r.responsaveis_ids}
            equipeToda={r.equipe_toda}
            options={colabs}
            max={3}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {isProcessing && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
              <span className="reuniao-processing-dot" />
              {phaseLabel}
            </span>
          )}
          {r.transcricao_status === "pausado" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
              ⏸ pausado
              {r.transcricao_partes_total
                ? ` ${r.transcricao_partes_feitas}/${r.transcricao_partes_total}`
                : ""}
            </span>
          )}
          {r.transcricao_status === "erro" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive">
              ⚠ erro IA
            </span>
          )}

          {r.participantes && r.participantes.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              <Users className="h-3 w-3" /> {r.participantes.length}
            </span>
          )}
          {r.temTranscricao && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              <FileText className="h-3 w-3" /> transcrição
            </span>
          )}
          {r.proximos_passos && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCheck className="h-3 w-3" /> próximos passos
            </span>
          )}
          {r.audio_path && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              🎵 áudio
            </span>
          )}
        </div>

        <div onClick={(e) => e.stopPropagation()} className="pt-1">
          <AssigneeCombobox
            options={colabs}
            selectedIds={r.responsaveis_ids ?? []}
            equipeToda={!!r.equipe_toda}
            onChange={(n) => onAtribuir(r.id, n)}
            placeholder="Atribuir..."
          />
        </div>
      </div>
    </div>
  );
}
