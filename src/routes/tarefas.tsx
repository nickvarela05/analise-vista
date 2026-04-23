import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AssigneeCombobox, AssigneeBadges } from "@/components/AssigneeCombobox";

export const Route = createFileRoute("/tarefas")({
  component: TarefasRoute,
});

function TarefasRoute() {
  return (
    <AppLayout>
      <Tarefas />
    </AppLayout>
  );
}

const WORKFLOW = ["aberta", "encaminhada", "homologacao", "producao", "reprovada"] as const;
const PRIO = ["baixa", "media", "alta"] as const;

function statusVariant(s: string) {
  if (s === "producao") return "bg-success/15 text-success border-success/30";
  if (s === "homologacao") return "bg-info/15 text-info border-info/30";
  if (s === "encaminhada") return "bg-warning/20 text-warning-foreground border-warning/40";
  if (s === "aberta") return "bg-primary/10 text-primary border-primary/20";
  if (s === "reprovada") return "bg-destructive/15 text-destructive border-destructive/30";
  return "bg-muted text-muted-foreground";
}

function prioVariant(p: string) {
  if (p === "alta") return "bg-destructive/15 text-destructive border-destructive/30";
  if (p === "media") return "bg-warning/20 text-warning-foreground border-warning/30";
  return "bg-success/15 text-success border-success/30";
}

function Tarefas() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = React.useState("todos");
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const [form, setForm] = React.useState({
    titulo: "",
    descricao: "",
    prioridade: "media" as (typeof PRIO)[number],
    status: "aberta" as string,
    data_prevista: "",
    responsaveis_ids: [] as string[],
    equipe_toda: false,
  });

  const { data: colabs = [] } = useQuery({
    queryKey: ["tar-colabs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaborador")
        .select("id, nome, cargo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ["tarefas", statusFilter, search],
    queryFn: async () => {
      let q = supabase.from("todo").select("*").order("created_at", { ascending: false });
      if (statusFilter !== "todos") q = q.eq("status", statusFilter as any);
      if (search) q = q.ilike("titulo", `%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const counts = {
    aberta: data.filter((t) => ["aberta", "pendente"].includes(t.status)).length,
    encaminhada: data.filter((t) => t.status === "encaminhada").length,
    homologacao: data.filter((t) => t.status === "homologacao").length,
    producao: data.filter((t) => t.status === "producao").length,
    reprovada: data.filter((t) => t.status === "reprovada").length,
  };

  const adicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) return;
    const { error } = await supabase.from("todo").insert({
      titulo: form.titulo,
      descricao: form.descricao || null,
      prioridade: form.prioridade,
      status: form.status as any,
      responsaveis_ids: form.responsaveis_ids,
      equipe_toda: form.equipe_toda,
      data_prevista: form.data_prevista || null,
      criado_por: user?.id,
    });
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    toast.success("Tarefa criada");
    setOpen(false);
    setForm({ ...form, titulo: "", descricao: "", data_prevista: "", responsaveis_ids: [], equipe_toda: false });
    qc.invalidateQueries({ queryKey: ["tarefas"] });
    qc.invalidateQueries({ queryKey: ["dash-tarefas"] });
    qc.invalidateQueries({ queryKey: ["dash-atribuicoes"] });
  };

  const updateAssignees = async (
    id: string,
    next: { selectedIds: string[]; equipeToda: boolean },
  ) => {
    const { error } = await supabase
      .from("todo")
      .update({ responsaveis_ids: next.selectedIds, equipe_toda: next.equipeToda })
      .eq("id", id);
    if (error) toast.error("Erro", { description: error.message });
    else {
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      qc.invalidateQueries({ queryKey: ["dash-atribuicoes"] });
    }
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("todo")
      .update({ status: status as any, concluida_em: status === "producao" ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) toast.error("Erro", { description: error.message });
    else {
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      qc.invalidateQueries({ queryKey: ["dash-tarefas"] });
    }
  };

  const remover = async (id: string) => {
    if (!confirm("Excluir esta tarefa?")) return;
    const { error } = await supabase.from("todo").delete().eq("id", id);
    if (error) toast.error("Erro", { description: error.message });
    else {
      toast.success("Tarefa removida");
      qc.invalidateQueries({ queryKey: ["tarefas"] });
    }
  };

  return (
    <div>
      <PageHeader
        title="Tarefas"
        description="Chamados internos. Fluxo: Abertura → Encaminhada → Homologação → Produção."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Nova tarefa</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Nova tarefa (chamado interno)</DialogTitle></DialogHeader>
              <form onSubmit={adicionar} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Título</Label>
                  <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Descrição</Label>
                  <Textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{WORKFLOW.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Prioridade</Label>
                    <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v as typeof form.prioridade })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PRIO.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Prazo</Label>
                    <Input type="date" value={form.data_prevista} onChange={(e) => setForm({ ...form, data_prevista: e.target.value })} />
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
                <DialogFooter><Button type="submit">Criar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-6">
        <StatCard
          title="Workflow"
          size="sm"
          items={[
            { value: counts.aberta, label: "Abertas", tone: "primary" },
            { value: counts.encaminhada, label: "Encaminhadas", tone: "warning" },
            { value: counts.homologacao, label: "Em HML", tone: "info" },
            { value: counts.producao, label: "Em produção", tone: "success" },
            { value: counts.reprovada, label: "Reprovadas", tone: "destructive" },
          ]}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {WORKFLOW.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        {isLoading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : data.length === 0 ? (
          <EmptyState title="Nenhuma tarefa" description="Crie a primeira tarefa para começar." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead className="w-44">Alterar status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.titulo}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize ${prioVariant(t.prioridade)}`}>{t.prioridade}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize ${statusVariant(t.status)}`}>{t.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {t.data_prevista ? format(new Date(t.data_prevista), "dd/MM/yyyy") : "—"}
                  </TableCell>
                  <TableCell>
                    <Select value={t.status} onValueChange={(v) => updateStatus(t.id, v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WORKFLOW.map((s) => <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => remover(t.id)} className="h-7 w-7">
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
