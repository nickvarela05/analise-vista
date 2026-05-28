import * as React from "react";
import { toast } from "sonner";
import { Clock, CalendarDays, Coffee, MapPin } from "lucide-react";
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
import { DialogHero } from "@/components/shared/DialogHero";
import { DialogSection } from "@/components/shared/DialogSection";
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
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Adicionar horário</DialogTitle>
        </DialogHeader>

        <div className="px-6 pt-6">
          <DialogHero
            icon={Clock}
            tone="cyan"
            eyebrow="Equipe · Horário"
            title="Adicionar horário"
            description="O horário será replicado para os dias úteis (segunda a sexta)."
          />
        </div>

        <form onSubmit={salvar} className="space-y-4 px-6 py-5">
          <DialogSection title="Dias aplicáveis" icon={CalendarDays} variant="tinted">
            <div className="flex h-9 w-full items-center rounded-md border border-input bg-background px-3 py-1 text-sm text-muted-foreground">
              Seg – Sex (replicado nos 5 dias)
            </div>
          </DialogSection>

          <DialogSection title="Expediente" icon={Clock}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Início</Label>
                <Input
                  type="time"
                  value={form.expediente_inicio}
                  onChange={(e) =>
                    setForm({ ...form, expediente_inicio: e.target.value })
                  }
                  className="focus-visible:ring-cyan-500/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fim</Label>
                <Input
                  type="time"
                  value={form.expediente_fim}
                  onChange={(e) =>
                    setForm({ ...form, expediente_fim: e.target.value })
                  }
                  className="focus-visible:ring-cyan-500/40"
                />
              </div>
            </div>
          </DialogSection>

          <DialogSection title="Almoço" icon={Coffee} variant="tinted">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Início</Label>
                <Input
                  type="time"
                  value={form.almoco_inicio}
                  onChange={(e) => setForm({ ...form, almoco_inicio: e.target.value })}
                  className="focus-visible:ring-cyan-500/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fim</Label>
                <Input
                  type="time"
                  value={form.almoco_fim}
                  onChange={(e) => setForm({ ...form, almoco_fim: e.target.value })}
                  className="focus-visible:ring-cyan-500/40"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                <MapPin className="mr-1 inline h-3 w-3" />
                Local do almoço
              </Label>
              <Select
                value={form.local_almoco}
                onValueChange={(v) => setForm({ ...form, local_almoco: v })}
              >
                <SelectTrigger className="focus-visible:ring-cyan-500/40">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Copa">Copa</SelectItem>
                  <SelectItem value="Fora">Fora</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </DialogSection>

          <DialogFooter className="gap-2 border-t pt-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-cyan-500 text-white hover:bg-cyan-600">
              Salvar horário
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
