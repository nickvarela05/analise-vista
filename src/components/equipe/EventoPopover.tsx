import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import type { Colaborador, EventoTipo } from "./lib/types";
import { EVENTO_LABEL } from "./lib/types";

const TIPOS: EventoTipo[] = ["folga", "falta", "atestado", "atraso", "ferias_avulso"];

export function EventoPopover({
  trigger,
  colaboradores,
  defaultDate,
  defaultColaboradorId,
}: {
  trigger: React.ReactNode;
  colaboradores: Pick<Colaborador, "id" | "nome">[];
  defaultDate: string;
  defaultColaboradorId?: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
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
      <PopoverContent className="w-[320px]" align="start">
        <form onSubmit={salvar} className="space-y-3">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold">Registrar evento</h4>
            <p className="text-xs text-muted-foreground">
              Folga, falta, atestado, atraso ou férias avulso.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Colaborador</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
              value={colabId}
              onChange={(e) => setColabId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {colaboradores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as EventoTipo)}
              >
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {EVENTO_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data</Label>
              <Input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
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
            />
          </div>

          {tipo === "atestado" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Anexo (comprovante)</Label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setAnexo(e.target.files?.[0] ?? null)}
              />
            </div>
          )}

          <Button type="submit" disabled={saving} size="sm" className="w-full">
            {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Registrar
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
