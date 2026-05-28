import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon, Link2, Plus } from "lucide-react";
import { toast } from "sonner";
import { DialogHero } from "@/components/shared/DialogHero";
import { DialogSection } from "@/components/shared/DialogSection";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { AssigneeCombobox, type AssigneeOption } from "@/components/AssigneeCombobox";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  demanda: {
    id: string;
    titulo: string;
    descricao?: string | null;
    responsaveis_ids: string[];
    equipe_toda: boolean;
    prazo?: string | null;
    prioridade: string;
  } | null;
  colabs: AssigneeOption[];
  userId?: string;
  onCreated: () => void;
}

const PRIO = ["baixa", "media", "alta"] as const;

export function CriarTarefaDialog({ open, onOpenChange, demanda, colabs, userId, onCreated }: Props) {
  const [titulo, setTitulo] = React.useState("");
  const [descricao, setDescricao] = React.useState("");
  const [prioridade, setPrioridade] = React.useState<(typeof PRIO)[number]>("media");
  const [prazo, setPrazo] = React.useState<string | null>(null);
  const [responsaveis, setResponsaveis] = React.useState<string[]>([]);
  const [equipeToda, setEquipeToda] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open && demanda) {
      setTitulo(demanda.titulo);
      setDescricao(demanda.descricao ?? "");
      const dp = demanda.prioridade === "critica" ? "alta" : (demanda.prioridade as (typeof PRIO)[number]);
      setPrioridade(PRIO.includes(dp) ? dp : "media");
      setPrazo(demanda.prazo ?? null);
      setResponsaveis(demanda.responsaveis_ids ?? []);
      setEquipeToda(!!demanda.equipe_toda);
    }
  }, [open, demanda]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demanda || !titulo.trim()) {
      toast.error("Informe um título");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("todo").insert({
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      prioridade,
      data_prevista: prazo,
      responsaveis_ids: responsaveis,
      equipe_toda: equipeToda,
      demanda_id: demanda.id,
      criado_por: userId,
      status: "aberta",
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao criar tarefa", { description: error.message });
      return;
    }
    toast.success("Tarefa criada e vinculada");
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden p-6">
        <DialogHeader className="sr-only">
          <DialogTitle>Criar tarefa vinculada</DialogTitle>
        </DialogHeader>
        <DialogHero
          icon={Link2}
          tone="indigo"
          eyebrow="Demandas → Tarefa"
          title="Criar tarefa vinculada"
          description={demanda ? `A partir de: ${demanda.titulo}` : undefined}
        />
        <form onSubmit={submit} className="space-y-4">
          <DialogSection title="Detalhes" variant="default">
            <div className="space-y-1.5">
              <Label className="text-xs">Título *</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição</Label>
              <Textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Prioridade</Label>
                <Select value={prioridade} onValueChange={(v) => setPrioridade(v as (typeof PRIO)[number])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIO.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Data prevista</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !prazo && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {prazo ? format(new Date(prazo + "T00:00:00"), "dd/MM/yyyy") : "Sem data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={prazo ? new Date(prazo + "T00:00:00") : undefined}
                      onSelect={(d) => setPrazo(d ? format(d, "yyyy-MM-dd") : null)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </DialogSection>

          <DialogSection title="Atribuição" variant="tinted">
            <div className="space-y-1.5">
              <Label className="text-xs">Atribuir a</Label>
              <AssigneeCombobox
                options={colabs}
                selectedIds={responsaveis}
                equipeToda={equipeToda}
                onChange={(n) => {
                  setResponsaveis(n.selectedIds);
                  setEquipeToda(n.equipeToda);
                }}
              />
            </div>
          </DialogSection>

          <DialogFooter className="-mx-6 -mb-6 mt-2 border-t bg-card/60 px-6 py-3 backdrop-blur">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              <Plus className="mr-1.5 h-4 w-4" />
              {saving ? "Criando..." : "Criar tarefa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
