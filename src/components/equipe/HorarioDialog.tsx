import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { DIAS } from "./lib/types";

export function HorarioDialog({
  open,
  onOpenChange,
  colaboradorId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  colaboradorId: string;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState({
    dia_semana: 1,
    expediente_inicio: "08:00",
    expediente_fim: "17:00",
    almoco_inicio: "12:00",
    almoco_fim: "13:00",
    local_almoco: "Copa",
  });

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase
      .from("colaborador_horario")
      .upsert(
        { colaborador_id: colaboradorId, ...form },
        { onConflict: "colaborador_id,dia_semana" },
      );
    if (error) toast.error("Erro", { description: error.message });
    else {
      toast.success("Horário salvo");
      onOpenChange(false);
      onSaved();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar horário</DialogTitle>
        </DialogHeader>
        <form onSubmit={salvar} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Dia da semana</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={form.dia_semana}
              onChange={(e) => setForm({ ...form, dia_semana: Number(e.target.value) })}
            >
              {DIAS.map((d, i) => (
                <option key={i} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Expediente início</Label>
              <Input
                type="time"
                value={form.expediente_inicio}
                onChange={(e) => setForm({ ...form, expediente_inicio: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Expediente fim</Label>
              <Input
                type="time"
                value={form.expediente_fim}
                onChange={(e) => setForm({ ...form, expediente_fim: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Almoço início</Label>
              <Input
                type="time"
                value={form.almoco_inicio}
                onChange={(e) => setForm({ ...form, almoco_inicio: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Almoço fim</Label>
              <Input
                type="time"
                value={form.almoco_fim}
                onChange={(e) => setForm({ ...form, almoco_fim: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Local do almoço</Label>
            <Select
              value={form.local_almoco}
              onValueChange={(v) => setForm({ ...form, local_almoco: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Copa">Copa</SelectItem>
                <SelectItem value="Fora">Fora</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
