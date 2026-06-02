import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Coffee, MapPin, Save, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { Colaborador, Horario } from "./lib/types";
import {
  COPA_CAPACIDADE,
  COPA_WINDOW_MIN,
  ocupacaoCopa,
  slotsExcedidos,
} from "@/lib/domain/copa";

const TIMELINE_INI = 11 * 60; // 11:00
const TIMELINE_FIM = 15 * 60; // 15:00
const TOTAL_MIN = TIMELINE_FIM - TIMELINE_INI;
const SNAP = 5; // minutos
const DIAS_SEMANA = [1, 2, 3, 4, 5];

function toMin(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}
function fromMin(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
}
function fmtHHMM(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

interface SlotEdit {
  colaborador_id: string;
  ai: number; // minutos
  af: number;
  local: "Copa" | "Fora";
  duracao: number;
  dirty: boolean;
  hadHorario: boolean;
  expediente_inicio: string | null;
  expediente_fim: string | null;
}

export function GestaoCopaView({ colabs }: { colabs: Colaborador[] }) {
  const qc = useQueryClient();
  const [dia, setDia] = React.useState<number>(() => {
    const d = new Date().getDay();
    return d >= 1 && d <= 5 ? d : 1;
  });
  const [saving, setSaving] = React.useState(false);

  const initialEdits = React.useMemo<Record<string, SlotEdit>>(() => {
    const map: Record<string, SlotEdit> = {};
    for (const c of colabs) {
      const h = c.colaborador_horario?.find((x) => x.dia_semana === dia);
      const ai = toMin(h?.almoco_inicio) ?? 12 * 60;
      const af = toMin(h?.almoco_fim) ?? 13 * 60;
      const local = (h?.local_almoco === "Fora" ? "Fora" : "Copa") as "Copa" | "Fora";
      map[c.id] = {
        colaborador_id: c.id,
        ai,
        af,
        local,
        duracao: af - ai,
        dirty: false,
        hadHorario: !!h,
        expediente_inicio: h?.expediente_inicio ?? "08:00:00",
        expediente_fim: h?.expediente_fim ?? "18:00:00",
      };
    }
    return map;
  }, [colabs, dia]);

  const [edits, setEdits] = React.useState<Record<string, SlotEdit>>(initialEdits);
  React.useEffect(() => setEdits(initialEdits), [initialEdits]);

  const dirtyCount = Object.values(edits).filter((e) => e.dirty).length;

  const update = (id: string, patch: Partial<SlotEdit>) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch, dirty: true } }));
  };

  // Capacidade da copa: considera apenas os PRIMEIROS 30 MIN do almoço de cada pessoa.
  const ocupSlots = React.useMemo(
    () =>
      ocupacaoCopa(
        Object.values(edits),
        TIMELINE_INI,
        TIMELINE_FIM,
        SNAP,
        COPA_WINDOW_MIN,
      ),
    [edits],
  );
  const copaSlots = React.useMemo(
    () =>
      ocupSlots.map((s) => ({
        min: s.min,
        count: s.count,
        nomes: s.ids.map((id) => colabs.find((c) => c.id === id)?.nome ?? ""),
      })),
    [ocupSlots, colabs],
  );

  const overflow = slotsExcedidos(ocupSlots, COPA_CAPACIDADE);
  const hasOverflow = overflow.length > 0;

  const salvar = async () => {
    const dirty = Object.values(edits).filter((e) => e.dirty);
    if (!dirty.length) return;
    setSaving(true);
    const rows = dirty.map((e) => ({
      colaborador_id: e.colaborador_id,
      dia_semana: dia,
      expediente_inicio: e.expediente_inicio,
      expediente_fim: e.expediente_fim,
      almoco_inicio: fromMin(e.ai),
      almoco_fim: fromMin(e.af),
      local_almoco: e.local,
    }));
    const { error } = await supabase
      .from("colaborador_horario")
      .upsert(rows, { onConflict: "colaborador_id,dia_semana" });
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }
    toast.success(`${dirty.length} horário(s) atualizado(s)`);
    qc.invalidateQueries({ queryKey: ["equipe"] });
  };

  const colabsCopa = colabs.filter((c) => edits[c.id]?.local === "Copa");
  const colabsFora = colabs.filter((c) => edits[c.id]?.local === "Fora");

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        {/* Toolbar */}
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Coffee className="h-4 w-4 text-primary" />
              <div>
                <div className="text-sm font-semibold">Gestão de copa</div>
                <div className="text-xs text-muted-foreground">
                  Arraste o bloco para mover, ou as bordas para redimensionar.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Dia:</span>
              <Select value={String(dia)} onValueChange={(v) => setDia(Number(v))}>
                <SelectTrigger className="h-8 w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIAS.map((d) => (
                    <SelectItem key={d.v} value={String(d.v)}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Users className="h-3 w-3" /> Capacidade copa: {COPA_CAPACIDADE}
            </Badge>
            {dirtyCount > 0 && (
              <Badge variant="outline" className="border-warning/50 text-warning">
                {dirtyCount} alteração(ões) pendentes
              </Badge>
            )}
            <Button size="sm" onClick={salvar} disabled={!dirtyCount || saving}>
              <Save className="mr-1 h-3.5 w-3.5" />
              Salvar
            </Button>
          </div>
        </Card>

        {hasOverflow && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">
                Capacidade da copa excedida em {overflow.length} intervalo(s) de 5 min.
              </div>
              <div className="opacity-80">
                Pico de {Math.max(...overflow.map((o) => o.count))} pessoas (limite{" "}
                {COPA_CAPACIDADE}). Realoque alguém para "Fora" ou ajuste os horários.
              </div>
            </div>
          </div>
        )}

        {/* Painéis */}
        <div className="grid gap-4 lg:grid-cols-2">
          <PainelLocal
            titulo="Copa"
            icone={<Coffee className="h-4 w-4" />}
            colabs={colabsCopa}
            edits={edits}
            onUpdate={update}
            onMover={(id) => update(id, { local: "Fora" })}
            mostrarHeatmap
            heatmap={copaSlots}
            destaqueOverflow
          />
          <PainelLocal
            titulo="Fora"
            icone={<MapPin className="h-4 w-4" />}
            colabs={colabsFora}
            edits={edits}
            onUpdate={update}
            onMover={(id) => update(id, { local: "Copa" })}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}

function PainelLocal({
  titulo,
  icone,
  colabs,
  edits,
  onUpdate,
  onMover,
  mostrarHeatmap,
  heatmap,
  destaqueOverflow,
}: {
  titulo: string;
  icone: React.ReactNode;
  colabs: Colaborador[];
  edits: Record<string, SlotEdit>;
  onUpdate: (id: string, patch: Partial<SlotEdit>) => void;
  onMover: (id: string) => void;
  mostrarHeatmap?: boolean;
  heatmap?: { min: number; count: number; nomes: string[] }[];
  destaqueOverflow?: boolean;
}) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md",
              titulo === "Copa"
                ? "bg-[var(--status-almoco)]/20 text-[oklch(0.45_0.16_70)]"
                : "bg-info/15 text-info",
            )}
          >
            {icone}
          </div>
          <div>
            <div className="text-sm font-semibold">{titulo}</div>
            <div className="text-[11px] text-muted-foreground">
              {colabs.length} colaborador(es)
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 p-3">
        <Ruler />
        {mostrarHeatmap && heatmap && (
          <Heatmap heatmap={heatmap} destaqueOverflow={destaqueOverflow} />
        )}
        {colabs.length === 0 && (
          <div className="rounded-md border border-dashed py-8 text-center text-xs text-muted-foreground">
            Nenhum colaborador
          </div>
        )}
        {colabs.map((c) => (
          <Linha
            key={c.id}
            colab={c}
            slot={edits[c.id]}
            onUpdate={onUpdate}
            onMover={onMover}
            destinoLabel={titulo === "Copa" ? "Mover para Fora" : "Mover para Copa"}
          />
        ))}
      </div>
    </Card>
  );
}

function Ruler() {
  const ticks: number[] = [];
  for (let m = TIMELINE_INI; m <= TIMELINE_FIM; m += 30) ticks.push(m);
  return (
    <div className="relative ml-[180px] h-4">
      {ticks.map((m) => {
        const left = ((m - TIMELINE_INI) / TOTAL_MIN) * 100;
        return (
          <div
            key={m}
            className="absolute top-0 -translate-x-1/2 text-[10px] text-muted-foreground"
            style={{ left: `${left}%` }}
          >
            {fmtHHMM(m)}
          </div>
        );
      })}
    </div>
  );
}

function Heatmap({
  heatmap,
  destaqueOverflow,
}: {
  heatmap: { min: number; count: number; nomes: string[] }[];
  destaqueOverflow?: boolean;
}) {
  return (
    <div className="ml-[180px] flex h-3 overflow-hidden rounded-sm border bg-muted/30">
      {heatmap.map((s, i) => {
        const ratio = Math.min(s.count / COPA_CAPACIDADE, 1);
        const over = s.count > COPA_CAPACIDADE;
        return (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "h-full flex-1",
                  over && destaqueOverflow
                    ? "bg-destructive"
                    : s.count === 0
                      ? ""
                      : "bg-[var(--status-almoco)]",
                )}
                style={!over && s.count > 0 ? { opacity: 0.3 + ratio * 0.7 } : undefined}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <div className="font-medium">
                {fmtHHMM(s.min)} — {s.count}/{COPA_CAPACIDADE}
              </div>
              {s.nomes.length > 0 && (
                <div className="text-muted-foreground">{s.nomes.join(", ")}</div>
              )}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

type DragMode = "move" | "left" | "right" | null;

function Linha({
  colab,
  slot,
  onUpdate,
  onMover,
  destinoLabel,
}: {
  colab: Colaborador;
  slot: SlotEdit;
  onUpdate: (id: string, patch: Partial<SlotEdit>) => void;
  onMover: (id: string) => void;
  destinoLabel: string;
}) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [drag, setDrag] = React.useState<{
    mode: DragMode;
    startX: number;
    startAi: number;
    startAf: number;
  } | null>(null);

  const left = ((slot.ai - TIMELINE_INI) / TOTAL_MIN) * 100;
  const width = ((slot.af - slot.ai) / TOTAL_MIN) * 100;

  const onPointerDown = (mode: Exclude<DragMode, null>) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ mode, startX: e.clientX, startAi: slot.ai, startAf: slot.af });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const dx = e.clientX - drag.startX;
    const dxMin = Math.round((dx / rect.width) * TOTAL_MIN / SNAP) * SNAP;

    let ai = drag.startAi;
    let af = drag.startAf;
    if (drag.mode === "move") {
      const dur = af - ai;
      ai = Math.max(TIMELINE_INI, Math.min(TIMELINE_FIM - dur, drag.startAi + dxMin));
      af = ai + dur;
    } else if (drag.mode === "left") {
      ai = Math.max(TIMELINE_INI, Math.min(af - SNAP * 2, drag.startAi + dxMin));
    } else if (drag.mode === "right") {
      af = Math.min(TIMELINE_FIM, Math.max(ai + SNAP * 2, drag.startAf + dxMin));
    }
    if (ai !== slot.ai || af !== slot.af) {
      onUpdate(colab.id, { ai, af });
    }
  };

  const onPointerUp = () => setDrag(null);

  const isCopa = slot.local === "Copa";
  const initials = colab.nome
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("");

  return (
    <div className="group flex items-center gap-2">
      {/* Coluna do colaborador */}
      <div className="flex w-[180px] shrink-0 items-center gap-2 pr-2">
        <Avatar className="h-7 w-7">
          {colab.foto_url && <AvatarImage src={colab.foto_url} />}
          <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium">{colab.nome}</div>
          <div className="truncate text-[10px] text-muted-foreground">
            {fmtHHMM(slot.ai)}–{fmtHHMM(slot.af)}{" "}
            <span className="opacity-60">({slot.af - slot.ai}min)</span>
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => onMover(colab.id)}
            >
              {isCopa ? <MapPin className="h-3 w-3" /> : <Coffee className="h-3 w-3" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">{destinoLabel}</TooltipContent>
        </Tooltip>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-8 flex-1 rounded-md border bg-muted/30"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* grid */}
        {Array.from({ length: (TOTAL_MIN / 30) - 1 }, (_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 w-px bg-border/60"
            style={{ left: `${((i + 1) * 30 / TOTAL_MIN) * 100}%` }}
          />
        ))}

        {/* bloco arrastável */}
        <div
          className={cn(
            "absolute top-1 bottom-1 flex items-center rounded-md text-[10px] font-medium text-white shadow-sm select-none touch-none transition-shadow",
            isCopa
              ? "bg-[var(--status-almoco)]"
              : "bg-info",
            slot.dirty && "ring-2 ring-primary/60",
            drag && "shadow-lg",
          )}
          style={{ left: `${left}%`, width: `${width}%` }}
          onPointerDown={onPointerDown("move")}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {/* handle esquerdo */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize rounded-l-md bg-black/20 hover:bg-black/40"
            onPointerDown={onPointerDown("left")}
          />
          <div className="flex-1 cursor-grab truncate px-2 text-center active:cursor-grabbing">
            {fmtHHMM(slot.ai)}–{fmtHHMM(slot.af)}
          </div>
          {/* handle direito */}
          <div
            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize rounded-r-md bg-black/20 hover:bg-black/40"
            onPointerDown={onPointerDown("right")}
          />
        </div>
      </div>
    </div>
  );
}
