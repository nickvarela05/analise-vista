import * as React from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
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

interface FormState {
  titulo: string;
  descricao: string;
  prioridade: (typeof PRIO)[number];
  status: string;
  data_prevista: string;
  responsaveis_ids: string[];
  equipe_toda: boolean;
  demanda_id: string | null;
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
        </DialogHeader>
        <form onSubmit={adicionar} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              rows={3}
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKFLOW.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select
                value={form.prioridade}
                onValueChange={(v) => setForm({ ...form, prioridade: v as FormState["prioridade"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIO.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prazo</Label>
              <Input
                type="date"
                value={form.data_prevista}
                onChange={(e) => setForm({ ...form, data_prevista: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Demanda vinculada</Label>
              <Select
                value={form.demanda_id ?? "none"}
                onValueChange={(v) => setForm({ ...form, demanda_id: v === "none" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {demandas.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Atribuir a</Label>
            <AssigneeCombobox
              options={colabs}
              selectedIds={form.responsaveis_ids}
              equipeToda={form.equipe_toda}
              onChange={(n) =>
                setForm({ ...form, responsaveis_ids: n.selectedIds, equipe_toda: n.equipeToda })
              }
            />
          </div>
          <DialogFooter>
            <Button type="submit">Criar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
