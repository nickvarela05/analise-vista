import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, FileBarChart } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatCard } from "@/components/StatCard";
import { AssigneeCombobox, AssigneeBadges } from "@/components/AssigneeCombobox";
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

export const Route = createFileRoute("/relatorios")({
  component: RelatoriosRoute,
});

function RelatoriosRoute() {
  return (
    <AppLayout>
      <Relatorios />
    </AppLayout>
  );
}

const STATUS_OPTS = ["aberto", "encaminhado", "finalizado"] as const;
type StatusRel = (typeof STATUS_OPTS)[number];
const PRIO_OPTS = ["baixa", "media", "alta", "critica"] as const;

const STATUS_LABEL: Record<StatusRel, string> = {
  aberto: "Aberto",
  encaminhado: "Encaminhado",
  finalizado: "Finalizado",
};

function statusVariant(s: string) {
  if (s === "finalizado") return "bg-success/15 text-success border-success/30";
  if (s === "aberto") return "bg-info/15 text-info border-info/30";
  if (s === "encaminhado") return "bg-warning/20 text-warning-foreground border-warning/40";
  return "bg-muted text-muted-foreground";
}

function prioVariant(p: string) {
  if (p === "critica") return "bg-destructive/15 text-destructive border-destructive/30";
  if (p === "alta") return "bg-warning/20 text-warning-foreground border-warning/30";
  if (p === "media") return "bg-primary/10 text-primary border-primary/20";
  return "bg-muted text-muted-foreground";
}

function Relatorios() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = React.useState<string>("todos");
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    codigo: "",
    titulo: "",
    descricao: "",
    cliente: "",
    modulo: "",
    status: "aberto" as StatusRel,
    prioridade: "media" as (typeof PRIO_OPTS)[number],
    responsaveis_ids: [] as string[],
    equipe_toda: false,
  });

  const { data: colabs = [] } = useQuery({
    queryKey: ["rel-colabs"],
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
    queryKey: ["chamados-externos", statusFilter, search],
    queryFn: async () => {
      let q = supabase.from("chamado_externo").select("*").order("abertura", { ascending: false });
      if (statusFilter !== "todos") q = q.eq("status", statusFilter as StatusRel);
      if (search) q = q.or(`titulo.ilike.%${search}%,codigo.ilike.%${search}%,cliente.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const counts = {
    aberto: data.filter((c) => c.status === "aberto").length,
    encaminhado: data.filter((c) => c.status === "encaminhado").length,
    finalizado: data.filter((c) => c.status === "finalizado").length,
  };

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.codigo.trim() || !form.titulo.trim()) {
      toast.error("Informe código e título");
      return;
    }
    const { error } = await supabase.from("chamado_externo").insert({
      codigo: form.codigo,
      titulo: form.titulo,
      descricao: form.descricao || null,
      cliente: form.cliente || null,
      modulo: form.modulo || null,
      status: form.status,
      prioridade: form.prioridade,
      responsaveis_ids: form.responsaveis_ids,
      equipe_toda: form.equipe_toda,
    });
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    toast.success("Relatório criado");
    setOpen(false);
    setForm({
      ...form,
      codigo: "",
      titulo: "",
      descricao: "",
      cliente: "",
      modulo: "",
      responsaveis_ids: [],
      equipe_toda: false,
    });
    qc.invalidateQueries({ queryKey: ["chamados-externos"] });
    qc.invalidateQueries({ queryKey: ["dash-chamados"] });
    qc.invalidateQueries({ queryKey: ["dash-atribuicoes"] });
  };

  const updateStatus = async (id: string, status: StatusRel) => {
    const { error } = await supabase.from("chamado_externo").update({ status }).eq("id", id);
    if (error) toast.error("Erro", { description: error.message });
    else {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["chamados-externos"] });
      qc.invalidateQueries({ queryKey: ["dash-chamados"] });
    }
  };

  const updateAssignees = async (
    id: string,
    next: { selectedIds: string[]; equipeToda: boolean },
  ) => {
    const { error } = await supabase
      .from("chamado_externo")
      .update({ responsaveis_ids: next.selectedIds, equipe_toda: next.equipeToda })
      .eq("id", id);
    if (error) toast.error("Erro", { description: error.message });
    else {
      qc.invalidateQueries({ queryKey: ["chamados-externos"] });
      qc.invalidateQueries({ queryKey: ["dash-atribuicoes"] });
    }
  };

  return (
    <div>
      <PageHeader
        title="Relatórios"
        description="Solicitações de relatórios. Workflow simplificado: Aberto → Encaminhado → Finalizado."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Novo relatório
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Novo relatório</DialogTitle>
              </DialogHeader>
              <form onSubmit={criar} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Código</Label>
                    <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="REL-2026-0011" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cliente</Label>
                    <Input value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Título</Label>
                  <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Descrição</Label>
                  <Textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Módulo</Label>
                    <Input value={form.modulo} onChange={(e) => setForm({ ...form, modulo: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as StatusRel })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTS.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Prioridade</Label>
                    <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v as typeof form.prioridade })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRIO_OPTS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
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
                    onChange={(n) => setForm({ ...form, responsaveis_ids: n.selectedIds, equipe_toda: n.equipeToda })}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit">Criar</Button>
                </DialogFooter>
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
            { value: counts.aberto, label: "Abertos", tone: "info" },
            { value: counts.encaminhado, label: "Encaminhados", tone: "warning" },
            { value: counts.finalizado, label: "Finalizados", tone: "success" },
          ]}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por código, título ou cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUS_OPTS.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        {isLoading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : data.length === 0 ? (
          <EmptyState icon={FileBarChart} title="Nenhum relatório" description="Crie um novo relatório para começar." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Atribuído a</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Abertura</TableHead>
                <TableHead className="w-56">Atribuir / Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
                  <TableCell className="font-medium">{c.titulo}</TableCell>
                  <TableCell className="text-muted-foreground">{c.cliente ?? "—"}</TableCell>
                  <TableCell>
                    <AssigneeBadges
                      selectedIds={c.responsaveis_ids}
                      equipeToda={c.equipe_toda}
                      options={colabs}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize ${prioVariant(c.prioridade)}`}>{c.prioridade}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusVariant(c.status)}>{STATUS_LABEL[c.status as StatusRel] ?? c.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(c.abertura), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1.5">
                      <AssigneeCombobox
                        options={colabs}
                        selectedIds={c.responsaveis_ids ?? []}
                        equipeToda={!!c.equipe_toda}
                        onChange={(n) => updateAssignees(c.id, n)}
                        placeholder="Atribuir..."
                      />
                      <Select value={c.status} onValueChange={(v) => updateStatus(c.id, v as StatusRel)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTS.map((s) => (
                            <SelectItem key={s} value={s} className="text-xs">{STATUS_LABEL[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
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
