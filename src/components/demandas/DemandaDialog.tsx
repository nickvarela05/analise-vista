import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon, X, Check, ListTodo } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AssigneeCombobox, type AssigneeOption } from "@/components/AssigneeCombobox";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  CATEGORIA_OPTS,
  ORIGEM_OPTS,
  PRIORIDADE_OPTS,
  type DemandaCategoria,
  type DemandaOrigem,
  type DemandaPrioridade,
} from "./lib/demanda-utils";

interface DemandaInitial {
  id?: string;
  titulo: string;
  descricao?: string | null;
  origem: DemandaOrigem;
  categoria: DemandaCategoria;
  prioridade: DemandaPrioridade;
  solicitante?: string | null;
  responsaveis_ids: string[];
  equipe_toda: boolean;
  prazo?: string | null;
  tags?: string[] | null;
}

const EMPTY: DemandaInitial = {
  titulo: "",
  descricao: "",
  origem: "email",
  categoria: "melhoria",
  prioridade: "media",
  solicitante: "",
  responsaveis_ids: [],
  equipe_toda: false,
  prazo: null,
  tags: [],
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: DemandaInitial | null;
  colabs: AssigneeOption[];
  userId?: string;
  onSaved: () => void;
}

export function DemandaDialog({ open, onOpenChange, initial, colabs, userId, onSaved }: Props) {
  const [form, setForm] = React.useState<DemandaInitial>(EMPTY);
  const [tagInput, setTagInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [tarefasDisponiveis, setTarefasDisponiveis] = React.useState<{ id: string; titulo: string; demanda_id: string | null }[]>([]);
  const [tarefasSelecionadas, setTarefasSelecionadas] = React.useState<string[]>([]);
  const [tarefasIniciais, setTarefasIniciais] = React.useState<string[]>([]);
  const [tarefasOpen, setTarefasOpen] = React.useState(false);
  const isEditing = !!initial?.id;

  React.useEffect(() => {
    if (open) {
      setForm(initial ? { ...EMPTY, ...initial, tags: initial.tags ?? [] } : EMPTY);
      setTagInput("");
      // Carrega tarefas disponíveis (sem demanda) + as já vinculadas a esta demanda (se editando)
      (async () => {
        const { data } = await supabase
          .from("todo")
          .select("id, titulo, demanda_id")
          .order("created_at", { ascending: false })
          .limit(500);
        setTarefasDisponiveis(data ?? []);
        if (isEditing && initial?.id) {
          const vinculadas = (data ?? []).filter((t) => t.demanda_id === initial.id).map((t) => t.id);
          setTarefasSelecionadas(vinculadas);
          setTarefasIniciais(vinculadas);
        } else {
          setTarefasSelecionadas([]);
          setTarefasIniciais([]);
        }
      })();
    }
  }, [open, initial, isEditing]);

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (!t) return;
    if ((form.tags ?? []).includes(t)) return;
    setForm({ ...form, tags: [...(form.tags ?? []), t] });
    setTagInput("");
  };

  const removeTag = (t: string) =>
    setForm({ ...form, tags: (form.tags ?? []).filter((x) => x !== t) });

  const toggleTarefa = (id: string) => {
    setTarefasSelecionadas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) {
      toast.error("Informe um título");
      return;
    }
    setSaving(true);
    const payload = {
      titulo: form.titulo.trim(),
      descricao: form.descricao?.trim() || null,
      origem: form.origem,
      categoria: form.categoria,
      prioridade: form.prioridade,
      solicitante: form.solicitante?.trim() || null,
      responsaveis_ids: form.responsaveis_ids,
      equipe_toda: form.equipe_toda,
      prazo: form.prazo || null,
      tags: form.tags && form.tags.length > 0 ? form.tags : null,
    };
    const { data: saved, error } = isEditing
      ? await supabase.from("demanda").update(payload).eq("id", initial!.id!).select("id").single()
      : await supabase.from("demanda").insert({ ...payload, criado_por: userId }).select("id").single();
    if (error || !saved) {
      setSaving(false);
      toast.error(isEditing ? "Erro ao atualizar" : "Erro ao criar", { description: error?.message });
      return;
    }

    // Vincula/desvincula tarefas
    const demandaId = saved.id;
    const aVincular = tarefasSelecionadas.filter((id) => !tarefasIniciais.includes(id));
    const aDesvincular = tarefasIniciais.filter((id) => !tarefasSelecionadas.includes(id));

    if (aVincular.length > 0) {
      const { error: e1 } = await supabase
        .from("todo")
        .update({ demanda_id: demandaId })
        .in("id", aVincular);
      if (e1) {
        toast.error("Erro ao vincular tarefas", { description: e1.message });
      }
    }
    if (aDesvincular.length > 0) {
      const { error: e2 } = await supabase
        .from("todo")
        .update({ demanda_id: null })
        .in("id", aDesvincular);
      if (e2) {
        toast.error("Erro ao desvincular tarefas", { description: e2.message });
      }
    }

    setSaving(false);
    toast.success(isEditing ? "Demanda atualizada" : "Demanda criada");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar demanda" : "Nova demanda"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input
              autoFocus
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Resumo curto da demanda"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              rows={4}
              value={form.descricao ?? ""}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder="Contexto, o que precisa ser feito, critérios de aceite..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Origem</Label>
              <Select value={form.origem} onValueChange={(v) => setForm({ ...form, origem: v as DemandaOrigem })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORIGEM_OPTS.map((o) => (
                    <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v as DemandaCategoria })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIA_OPTS.map((o) => (
                    <SelectItem key={o} value={o} className="capitalize">{o.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v as DemandaPrioridade })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORIDADE_OPTS.map((o) => (
                    <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prazo</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !form.prazo && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.prazo ? format(new Date(form.prazo + "T00:00:00"), "dd/MM/yyyy") : "Sem prazo"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.prazo ? new Date(form.prazo + "T00:00:00") : undefined}
                    onSelect={(d) => setForm({ ...form, prazo: d ? format(d, "yyyy-MM-dd") : null })}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                  {form.prazo && (
                    <div className="border-t p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setForm({ ...form, prazo: null })}
                      >
                        Limpar prazo
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Solicitante</Label>
              <Input
                value={form.solicitante ?? ""}
                onChange={(e) => setForm({ ...form, solicitante: e.target.value })}
                placeholder="Nome de quem solicitou (cliente, área...)"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Atribuir a</Label>
            <AssigneeCombobox
              options={colabs}
              selectedIds={form.responsaveis_ids}
              equipeToda={form.equipe_toda}
              onChange={(n) => setForm({ ...form, responsaveis_ids: n.selectedIds, equipe_toda: n.equipeToda })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Digite e pressione Enter"
              />
              <Button type="button" variant="outline" onClick={addTag}>
                Adicionar
              </Button>
            </div>
            {(form.tags ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {(form.tags ?? []).map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1 text-[10px]">
                    {t}
                    <button
                      type="button"
                      onClick={() => removeTag(t)}
                      className="ml-0.5 rounded-sm hover:bg-background/40"
                      aria-label={`Remover ${t}`}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <ListTodo className="h-3.5 w-3.5" />
              Vincular tarefas
              {tarefasSelecionadas.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 text-[10px]">
                  {tarefasSelecionadas.length}
                </Badge>
              )}
            </Label>
            <Popover open={tarefasOpen} onOpenChange={setTarefasOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-start text-left font-normal">
                  {tarefasSelecionadas.length === 0
                    ? "Selecione tarefas para vincular..."
                    : `${tarefasSelecionadas.length} tarefa(s) selecionada(s)`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar tarefa..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma tarefa encontrada.</CommandEmpty>
                    <CommandGroup>
                      <ScrollArea className="h-60">
                        {tarefasDisponiveis.map((t) => {
                          const selected = tarefasSelecionadas.includes(t.id);
                          const vinculadaOutra = !!t.demanda_id && t.demanda_id !== initial?.id;
                          return (
                            <CommandItem
                              key={t.id}
                              value={`${t.titulo} ${t.id}`}
                              onSelect={() => toggleTarefa(t.id)}
                              className="flex items-start gap-2"
                            >
                              <div
                                className={cn(
                                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                  selected ? "bg-primary border-primary text-primary-foreground" : "border-input",
                                )}
                              >
                                {selected && <Check className="h-3 w-3" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm">{t.titulo}</div>
                                {vinculadaOutra && (
                                  <div className="text-[10px] text-warning">
                                    Já vinculada a outra demanda — será movida
                                  </div>
                                )}
                              </div>
                            </CommandItem>
                          );
                        })}
                      </ScrollArea>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-[11px] text-muted-foreground">
              As tarefas selecionadas serão automaticamente vinculadas a esta demanda.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar demanda"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
