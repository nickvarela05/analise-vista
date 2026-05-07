import * as React from "react";
import { toast } from "sonner";
import {
  Loader2,
  Check,
  ChevronsUpDown,
  CalendarOff,
  UserX,
  Stethoscope,
  Clock,
  Plane,
  Building2,
  MapPin,
  Paperclip,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { EventoTipo, LocalTrabalho } from "./lib/types";
import { EVENTO_LABEL, LOCAL_TRABALHO_LABEL } from "./lib/types";

type ColabOption = {
  id: string;
  nome: string;
  cargo?: string | null;
  foto_url?: string | null;
  local_trabalho?: LocalTrabalho | null;
};

const TIPOS: {
  value: EventoTipo;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}[] = [
  { value: "folga", icon: CalendarOff, tone: "text-[var(--status-fora)]" },
  { value: "falta", icon: UserX, tone: "text-destructive" },
  { value: "atestado", icon: Stethoscope, tone: "text-[var(--status-evento)]" },
  { value: "atraso", icon: Clock, tone: "text-[var(--status-almoco)]" },
  { value: "ferias_avulso", icon: Plane, tone: "text-[var(--status-ferias)]" },
];

function initials(nome: string) {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function EventoPopover({
  trigger,
  colaboradores,
  defaultDate,
  defaultColaboradorId,
}: {
  trigger: React.ReactNode;
  colaboradores: ColabOption[];
  defaultDate: string;
  defaultColaboradorId?: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [colabId, setColabId] = React.useState(defaultColaboradorId ?? "");
  const [tipo, setTipo] = React.useState<EventoTipo>("falta");
  const [data, setData] = React.useState(defaultDate);
  const [horaIni, setHoraIni] = React.useState("");
  const [horaFim, setHoraFim] = React.useState("");
  const [obs, setObs] = React.useState("");
  const [anexo, setAnexo] = React.useState<File | null>(null);

  React.useEffect(() => {
    if (open) {
      setData(defaultDate);
      setColabId(defaultColaboradorId ?? "");
      setTipo("falta");
      setHoraIni("");
      setHoraFim("");
      setObs("");
      setAnexo(null);
    }
  }, [open, defaultDate, defaultColaboradorId]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, ColabOption[]>();
    for (const c of colaboradores) {
      const key = (c.local_trabalho ?? "escritorio") as LocalTrabalho;
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.nome.localeCompare(b.nome));
    return map;
  }, [colaboradores]);

  const selected = colaboradores.find((c) => c.id === colabId);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colabId || !data) {
      toast.error("Selecione colaborador e data");
      return;
    }
    setSaving(true);
    let anexo_url: string | null = null;
    if (anexo && tipo === "atestado") {
      const path = `${colabId}/${Date.now()}-${anexo.name}`;
      const { error: upErr } = await supabase.storage
        .from("colaborador-eventos")
        .upload(path, anexo);
      if (upErr) {
        setSaving(false);
        toast.error("Erro no upload", { description: upErr.message });
        return;
      }
      anexo_url = path;
    }
    const { error } = await supabase.from("colaborador_evento").insert({
      colaborador_id: colabId,
      tipo,
      data,
      hora_inicio: tipo === "atraso" ? horaIni || null : null,
      hora_fim: tipo === "atraso" ? horaFim || null : null,
      observacao: obs || null,
      anexo_url,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    toast.success("Evento registrado");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["equipe"] });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <form onSubmit={salvar} className="space-y-4 p-4">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold">Registrar evento</h4>
            <p className="text-xs text-muted-foreground">
              Folga, falta, atestado, atraso ou férias avulso.
            </p>
          </div>

          {/* Colaborador picker com busca + avatar + agrupamento */}
          <div className="space-y-1.5">
            <Label className="text-xs">Colaborador</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  className={cn(
                    "h-auto w-full justify-between px-2 py-1.5 font-normal",
                    !selected && "text-muted-foreground",
                  )}
                >
                  {selected ? (
                    <span className="flex items-center gap-2 truncate">
                      <Avatar className="h-6 w-6">
                        {selected.foto_url && <AvatarImage src={selected.foto_url} />}
                        <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                          {initials(selected.nome)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex flex-col items-start leading-tight">
                        <span className="truncate text-sm">{selected.nome}</span>
                        {selected.cargo && (
                          <span className="truncate text-[10px] text-muted-foreground">
                            {selected.cargo}
                          </span>
                        )}
                      </span>
                    </span>
                  ) : (
                    <span className="text-sm">Selecione um colaborador...</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-3.5 w-3.5 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar colaborador..." />
                  <CommandList className="max-h-[260px]">
                    <CommandEmpty>Nenhum colaborador.</CommandEmpty>
                    {(["escritorio", "rua"] as LocalTrabalho[]).map((local) => {
                      const arr = grouped.get(local);
                      if (!arr || arr.length === 0) return null;
                      const Icon = local === "escritorio" ? Building2 : MapPin;
                      return (
                        <CommandGroup
                          key={local}
                          heading={
                            <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider">
                              <Icon className="h-3 w-3" />
                              {LOCAL_TRABALHO_LABEL[local]}
                            </span>
                          }
                        >
                          {arr.map((c) => {
                            const checked = c.id === colabId;
                            return (
                              <CommandItem
                                key={c.id}
                                value={`${c.nome} ${c.cargo ?? ""}`}
                                onSelect={() => {
                                  setColabId(c.id);
                                  setPickerOpen(false);
                                }}
                                className="gap-2"
                              >
                                <Avatar className="h-6 w-6">
                                  {c.foto_url && <AvatarImage src={c.foto_url} />}
                                  <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                                    {initials(c.nome)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-1 flex-col leading-tight">
                                  <span className="text-sm">{c.nome}</span>
                                  {c.cargo && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {c.cargo}
                                    </span>
                                  )}
                                </div>
                                <Check
                                  className={cn(
                                    "h-4 w-4",
                                    checked ? "opacity-100" : "opacity-0",
                                  )}
                                />
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      );
                    })}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Tipo como grid de botões com ícone */}
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <div className="grid grid-cols-5 gap-1">
              {TIPOS.map((t) => {
                const active = tipo === t.value;
                const Icon = t.icon;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTipo(t.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-md border px-1 py-1.5 text-[10px] leading-tight transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border/60 bg-card text-muted-foreground hover:bg-muted/40",
                    )}
                    title={EVENTO_LABEL[t.value]}
                  >
                    <Icon className={cn("h-3.5 w-3.5", active ? t.tone : "")} />
                    <span className="truncate">{EVENTO_LABEL[t.value]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Data</Label>
            <Input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>

          {tipo === "atraso" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Chegou às</Label>
                <Input
                  type="time"
                  value={horaIni}
                  onChange={(e) => setHoraIni(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Esperado às</Label>
                <Input
                  type="time"
                  value={horaFim}
                  onChange={(e) => setHoraFim(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Observação</Label>
            <Textarea
              rows={2}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Detalhes opcionais..."
            />
          </div>

          {tipo === "atestado" && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1 text-xs">
                <Paperclip className="h-3 w-3" /> Anexo (comprovante)
              </Label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setAnexo(e.target.files?.[0] ?? null)}
              />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} size="sm" className="flex-1">
              {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Registrar
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
