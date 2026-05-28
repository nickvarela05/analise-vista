import * as React from "react";
import { toast } from "sonner";
import { Plane, CalendarRange, MessageSquare } from "lucide-react";
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
import { DialogHero } from "@/components/shared/DialogHero";
import { DialogSection } from "@/components/shared/DialogSection";
import { Badge } from "@/components/ui/badge";
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

  const diasUteis = React.useMemo(() => {
    if (!form.data_inicio || !form.data_fim) return 0;
    const start = new Date(form.data_inicio + "T00:00:00");
    const end = new Date(form.data_fim + "T00:00:00");
    if (end < start) return 0;
    return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  }, [form.data_inicio, form.data_fim]);

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
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Período de férias</DialogTitle>
        </DialogHeader>

        <div className="px-6 pt-6">
          <DialogHero
            icon={Plane}
            tone="sky"
            eyebrow="Equipe · Férias"
            title="Período de férias"
            description="Registre o intervalo. O colaborador aparecerá como “em férias” durante todo o período."
            chips={
              diasUteis > 0 ? (
                <Badge
                  variant="outline"
                  className="gap-1 border-sky-500/40 bg-sky-500/10 text-[10px] text-sky-700 dark:text-sky-300"
                >
                  <CalendarRange className="h-3 w-3" />
                  {diasUteis} {diasUteis === 1 ? "dia" : "dias"}
                </Badge>
              ) : null
            }
          />
        </div>

        <form onSubmit={salvar} className="space-y-4 px-6 py-5">
          <DialogSection title="Intervalo" icon={CalendarRange}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Início</Label>
                <Input
                  type="date"
                  value={form.data_inicio}
                  onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
                  className="focus-visible:ring-sky-500/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fim</Label>
                <Input
                  type="date"
                  value={form.data_fim}
                  min={form.data_inicio || undefined}
                  onChange={(e) => setForm({ ...form, data_fim: e.target.value })}
                  className="focus-visible:ring-sky-500/40"
                />
              </div>
            </div>
          </DialogSection>

          <DialogSection title="Observação" icon={MessageSquare} variant="tinted">
            <Textarea
              rows={3}
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              placeholder="Ex.: cobertura por João até o retorno."
              className="resize-none focus-visible:ring-sky-500/40"
            />
          </DialogSection>

          <DialogFooter className="gap-2 border-t pt-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-sky-500 text-white hover:bg-sky-600">
              Salvar férias
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
