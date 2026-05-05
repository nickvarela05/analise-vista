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
    expediente_inicio: "08:00",
    expediente_fim: "18:00",
    almoco_inicio: "12:00",
    almoco_fim: "13:00",
    local_almoco: "Copa",
  });

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const rows = [1, 2, 3, 4, 5].map((dia_semana) => ({
      colaborador_id: colaboradorId,
      dia_semana,
      ...form,
    }));
    const { error } = await supabase
      .from("colaborador_horario")
      .upsert(rows, { onConflict: "colaborador_id,dia_semana" });
    if (error) toast.error("Erro", { description: error.message });
    else {
      toast.success("Horário salvo para Seg–Sex");
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
            <Label>Dias da semana</Label>
            <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 py-1 text-sm text-muted-foreground">
              Seg – Sex (replicado nos 5 dias)
            </div>
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
