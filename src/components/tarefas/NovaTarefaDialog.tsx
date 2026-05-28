import * as React from "react";
import { Plus, ListChecks, FlaskConical, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { qk } from "@/lib/queries/keys";
import { AssigneeCombobox } from "@/components/AssigneeCombobox";
import { WORKFLOW, STATUS_LABEL, PRIO } from "@/components/tarefas/lib/workflow";
import type { ColabMini, DemandaMini } from "@/components/tarefas/useTarefasData";
import { DialogHero } from "@/components/shared/DialogHero";
import { DialogSection } from "@/components/shared/DialogSection";

interface FormState {
  titulo: string;
  descricao: string;
  prioridade: (typeof PRIO)[number];
  status: string;
  data_prevista: string;
  responsaveis_ids: string[];
  equipe_toda: boolean;
  demanda_id: string | null;
  em_teste: boolean;
}

const initialForm: FormState = {
  titulo: "",
  descricao: "",
  prioridade: "media",
  status: "aberta",
  data_prevista: "",
  responsaveis_ids: [],
  equipe_toda: false,
  demanda_id: null,
  em_teste: false,
};

export function NovaTarefaDialog({
  colabs,
  demandas,
  open: openProp,
  onOpenChange,
  defaultData,
  hideTrigger,
}: {
  colabs: ColabMini[];
  demandas: DemandaMini[];
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  defaultData?: string;
  hideTrigger?: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  };
  const [form, setForm] = React.useState<FormState>({ ...initialForm, data_prevista: defaultData ?? "" });

  React.useEffect(() => {
    if (open) setForm((f) => ({ ...f, data_prevista: defaultData ?? f.data_prevista }));
  }, [open, defaultData]);

  const adicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) return;
    const { error } = await supabase.from("todo").insert({
      titulo: form.titulo,
      descricao: form.descricao || null,
      prioridade: form.prioridade,
      status: form.status as never,
      responsaveis_ids: form.responsaveis_ids,
      equipe_toda: form.equipe_toda,
      data_prevista: form.data_prevista || null,
      demanda_id: form.demanda_id,
      em_teste: form.em_teste,
      criado_por: user?.id,
    });
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    toast.success("Tarefa criada");
    setOpen(false);
    setForm(initialForm);
    qc.invalidateQueries({ queryKey: qk.tarefas.all() });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Nova tarefa
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-xl overflow-hidden p-6">
        <DialogHeader className="sr-only">
          <DialogTitle>Nova tarefa</DialogTitle>
        </DialogHeader>
        <DialogHero
          icon={ListChecks}
          tone="primary"
          eyebrow="Tarefas"
          title="Nova tarefa"
          description="Crie uma tarefa e atribua a um ou mais responsáveis."
        />
        <form onSubmit={adicionar} className="space-y-4">
          <DialogSection title="Detalhes" variant="default">
            <div className="space-y-1.5">
              <Label className="text-xs">Título</Label>
              <Input
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                autoFocus
                placeholder="Resumo curto da tarefa"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição</Label>
              <Textarea
                rows={3}
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Contexto, critérios de aceite..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WORKFLOW.map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Prioridade</Label>
                <Select
                  value={form.prioridade}
                  onValueChange={(v) => setForm({ ...form, prioridade: v as FormState["prioridade"] })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIO.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Prazo</Label>
                <Input
                  type="date"
                  value={form.data_prevista}
                  onChange={(e) => setForm({ ...form, data_prevista: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Demanda vinculada</Label>
                <Select
                  value={form.demanda_id ?? "none"}
                  onValueChange={(v) => setForm({ ...form, demanda_id: v === "none" ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {demandas.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.titulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogSection>

          <DialogSection title="Atribuição" variant="tinted">
            <div className="space-y-1.5">
              <Label className="text-xs">Atribuir a</Label>
              <AssigneeCombobox
                options={colabs}
                selectedIds={form.responsaveis_ids}
                equipeToda={form.equipe_toda}
                onChange={(n) =>
                  setForm({ ...form, responsaveis_ids: n.selectedIds, equipe_toda: n.equipeToda })
                }
              />
            </div>
            <label className="flex items-start gap-2 rounded-md border border-info/30 bg-info/5 p-2.5 cursor-pointer hover:bg-info/10 transition">
              <Checkbox
                checked={form.em_teste}
                onCheckedChange={(v) => setForm({ ...form, em_teste: v === true })}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <FlaskConical className="h-3.5 w-3.5 text-info" />
                  Em teste
                </span>
                <p className="text-xs text-muted-foreground">
                  Sinaliza que esta tarefa está sob teste/validação.
                </p>
              </div>
            </label>
          </DialogSection>

          <DialogFooter className="-mx-6 -mb-6 mt-4 border-t bg-card/60 px-6 py-3 backdrop-blur sm:justify-between">
            <p className="hidden text-[11px] text-muted-foreground sm:flex sm:items-center sm:gap-1">
              <Sparkles className="h-3 w-3" /> Atalho: pressione Enter para criar
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit">
                <Plus className="mr-1.5 h-4 w-4" /> Criar tarefa
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
