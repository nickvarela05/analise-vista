import { Pencil, Trash2, AlertTriangle, Link2 } from "lucide-react";

import { AssigneeBadges, type AssigneeOption } from "@/components/AssigneeCombobox";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { cn } from "@/lib/utils";
import {
  COR_BG,
  COR_BG_SOFT,
  STATUS_LABEL,
  STATUS_TONE,
  computarStatusDinamico,
  desvioReal,
  diasParaInicio,
  duracaoDias,
  fmtBR,
  fmtBRData,
  parseISODate,
  type Processo,
  type ProcessoVinculo,
} from "@/components/processos/processos-lib";

// ---------- Card lista ----------

export function ProcessoCard({
  processo: p,
  colabs,
  vinculos,
  tarefasMini,
  demandasMini,
  onEdit,
  onDelete,
}: {
  processo: Processo;
  colabs: AssigneeOption[];
  vinculos: ProcessoVinculo[];
  tarefasMini: { id: string; titulo: string }[];
  demandasMini: { id: string; titulo: string }[];
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const s = computarStatusDinamico(p);
  const dias = diasParaInicio(p);
  const proximo = dias !== null && dias >= 0 && dias <= p.alerta_dias_antes && s !== "concluido";
  const durPrev = duracaoDias(p.previsto_inicio, p.previsto_fim);
  const durReal = duracaoDias(p.real_inicio, p.real_fim);
  const dev = desvioReal(p.previsto_inicio, p.previsto_fim, p.real_inicio, p.real_fim);

  const tarefaMap = new Map(tarefasMini.map((t) => [t.id, t.titulo]));
  const demandaMap = new Map(demandasMini.map((d) => [d.id, d.titulo]));

  const toFracAno = (s: string | null): number | null => {
    const d = parseISODate(s);
    if (!d) return null;
    const ano = p.ano;
    if (d.getFullYear() < ano) return 0;
    if (d.getFullYear() > ano) return 12;
    const diasNoMes = new Date(ano, d.getMonth() + 1, 0).getDate();
    return d.getMonth() + (d.getDate() - 1) / diasNoMes;
  };
  const pStart = toFracAno(p.previsto_inicio);
  const pEnd = toFracAno(p.previsto_fim);
  const rStart = toFracAno(p.real_inicio);
  const rEnd = toFracAno(p.real_fim);

  return (
    <Card className={cn("overflow-hidden", proximo && "ring-1 ring-amber-500/40")}>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className={cn("mt-1 h-4 w-4 shrink-0 rounded-full", COR_BG[p.cor])} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold">{p.nome}</h3>
                <Badge
                  variant="outline"
                  className={cn("text-[10px]", STATUS_TONE[s].text, STATUS_TONE[s].ring)}
                >
                  {STATUS_LABEL[s]}
                </Badge>
                {proximo && (
                  <Badge className="gap-1 bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/30 hover:bg-amber-500/20 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3" />
                    {dias === 0 ? "Começa hoje" : `Em ${dias} dia${dias === 1 ? "" : "s"}`}
                  </Badge>
                )}
              </div>
              {p.descricao && <p className="mt-1 text-sm text-muted-foreground">{p.descricao}</p>}
            </div>
          </div>

          {(onEdit || onDelete) && (
            <div className="flex gap-1">
              {onEdit && (
                <Button size="icon" variant="ghost" onClick={onEdit}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onDelete}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Mini timeline comparativa */}
        <div className="mt-3 rounded-lg border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Visualização anual</span>
            {dev.dias !== null && dev.dias > 0 && (
              <span
                className={cn(
                  "font-medium",
                  dev.tipo === "atraso"
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-emerald-600 dark:text-emerald-400",
                )}
              >
                {dev.tipo === "atraso" ? "Início com atraso" : "Início adiantado"} de {dev.dias} dia
                {dev.dias === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <div className="relative h-10">
            <div className="pointer-events-none absolute inset-0 grid grid-cols-12">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="border-l first:border-l-0" />
              ))}
            </div>
            {pStart !== null && pEnd !== null && pEnd >= pStart && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="absolute top-1 flex h-3 items-center rounded-sm border-2 border-dashed"
                    style={{
                      left: `${(pStart / 12) * 100}%`,
                      width: `${Math.max(1, ((pEnd - pStart) / 12) * 100)}%`,
                      borderColor: `color-mix(in oklab, var(--${p.cor}) 60%, transparent)`,
                      backgroundColor: `color-mix(in oklab, var(--${p.cor}) 12%, transparent)`,
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top">
                  Previsto: {fmtBR(p.previsto_inicio)} → {fmtBR(p.previsto_fim)}
                  {durPrev !== null ? ` · ${durPrev} dias` : ""}
                </TooltipContent>
              </Tooltip>
            )}
            {rStart !== null && rEnd !== null && rEnd >= rStart && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "absolute bottom-1 flex h-3 items-center rounded-sm",
                      COR_BG[p.cor],
                    )}
                    style={{
                      left: `${(rStart / 12) * 100}%`,
                      width: `${Math.max(1, ((rEnd - rStart) / 12) * 100)}%`,
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Real: {fmtBR(p.real_inicio)} → {fmtBR(p.real_fim)}
                  {durReal !== null ? ` · ${durReal} dias` : ""}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-block h-2 w-4 rounded-sm border border-dashed",
                  COR_BG_SOFT[p.cor],
                )}
              />
              Previsto{durPrev !== null ? ` · ${durPrev}d` : ""}
            </span>
            <span className="flex items-center gap-1.5">
              <span className={cn("inline-block h-2 w-4 rounded-sm", COR_BG[p.cor])} />
              Real{durReal !== null ? ` · ${durReal}d` : " — ainda não definido"}
            </span>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <InfoBloco titulo="Previsto" inicio={p.previsto_inicio} fim={p.previsto_fim} />
          <InfoBloco titulo="Real" inicio={p.real_inicio} fim={p.real_fim} />
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Responsáveis
            </p>
            <AssigneeBadges
              selectedIds={p.responsaveis_ids}
              equipeToda={p.equipe_toda}
              options={colabs}
            />
          </div>
        </div>

        {vinculos.length > 0 && (
          <div className="mt-3 border-t pt-3">
            <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Link2 className="h-3 w-3" /> Vínculos
            </p>
            <div className="flex flex-wrap gap-1">
              {vinculos.map((v) => {
                const label =
                  v.tipo === "tarefa" ? tarefaMap.get(v.ref_id) : demandaMap.get(v.ref_id);
                return (
                  <Badge key={v.id} variant="secondary" className="text-[10px]">
                    {v.tipo === "tarefa" ? "Tarefa" : "Demanda"}: {label ?? "(removido)"}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {p.observacoes && (
          <div className="mt-3 border-t pt-3 text-sm text-muted-foreground">{p.observacoes}</div>
        )}
      </CardContent>
    </Card>
  );
}

function InfoBloco({
  titulo,
  inicio,
  fim,
}: {
  titulo: string;
  inicio: string | null;
  fim: string | null;
}) {
  const dur = duracaoDias(inicio, fim);
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {titulo}
      </p>
      <p className="text-sm font-medium">
        {fmtBRData(inicio)} <span className="text-muted-foreground">→</span> {fmtBRData(fim)}
      </p>
      {dur !== null && (
        <p className="text-xs text-muted-foreground">
          {dur} dia{dur === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}
