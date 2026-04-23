import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export function FeriasDialog({
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
    data_inicio: "",
    data_fim: "",
    observacao: "",
  });

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.data_inicio || !form.data_fim) {
      toast.error("Informe início e fim");
      return;
    }
    const { error } = await supabase
      .from("colaborador_ferias")
      .insert({ colaborador_id: colaboradorId, ...form });
    if (error) toast.error("Erro", { description: error.message });
    else {
      toast.success("Férias registradas");
      onOpenChange(false);
      onSaved();
      setForm({ data_inicio: "", data_fim: "", observacao: "" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Período de férias</DialogTitle>
        </DialogHeader>
        <form onSubmit={salvar} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Início</Label>
              <Input
                type="date"
                value={form.data_inicio}
                onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fim</Label>
              <Input
                type="date"
                value={form.data_fim}
                onChange={(e) => setForm({ ...form, data_fim: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Textarea
              rows={2}
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button type="submit">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
