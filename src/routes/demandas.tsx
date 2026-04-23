import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
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
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AssigneeCombobox, AssigneeBadges } from "@/components/AssigneeCombobox";

export const Route = createFileRoute("/demandas")({
  component: DemandasRoute,
});

function DemandasRoute() {
  return (
    <AppLayout>
      <Demandas />
    </AppLayout>
  );
}

const STATUS_OPTS = [
  "aberta",
  "em_analise",
  "em_andamento",
  "aguardando_cliente",
  "homologacao",
  "concluida",
  "cancelada",
] as const;
const PRIORIDADE_OPTS = ["baixa", "media", "alta", "critica"] as const;
const CATEGORIA_OPTS = ["bug", "melhoria", "nova_funcionalidade", "duvida", "documentacao", "outro"] as const;
const ORIGEM_OPTS = ["email", "reuniao", "chamado", "whatsapp", "outro"] as const;

function statusVariant(s: string) {
  if (s === "concluida") return "bg-success/15 text-success border-success/30";
  if (s === "cancelada") return "bg-muted text-muted-foreground";
  if (s === "aberta") return "bg-info/15 text-info border-info/30";
  return "bg-primary/10 text-primary border-primary/20";
}

function prioridadeVariant(p: string) {
  if (p === "critica") return "bg-destructive/15 text-destructive border-destructive/30";
  if (p === "alta") return "bg-warning/20 text-warning-foreground border-warning/30";
  if (p === "media") return "bg-primary/10 text-primary border-primary/20";
  return "bg-muted text-muted-foreground";
}

function Demandas() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = React.useState<string>("todos");
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["demandas", statusFilter, search],
    queryFn: async () => {
      let q = supabase.from("demanda").select("*").order("created_at", { ascending: false });
      if (statusFilter !== "todos") q = q.eq("status", statusFilter as (typeof STATUS_OPTS)[number]);
      if (search) q = q.ilike("titulo", `%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const [form, setForm] = React.useState({
    titulo: "",
    descricao: "",
    origem: "email" as (typeof ORIGEM_OPTS)[number],
    categoria: "melhoria" as (typeof CATEGORIA_OPTS)[number],
    prioridade: "media" as (typeof PRIORIDADE_OPTS)[number],
    solicitante: "",
    responsaveis_ids: [] as string[],
    equipe_toda: false,
  });

  const { data: colabs = [] } = useQuery({
    queryKey: ["dem-colabs"],
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) {
      toast.error("Informe um título");
      return;
    }
    const { error } = await supabase.from("demanda").insert({
      titulo: form.titulo,
      descricao: form.descricao || null,
      origem: form.origem,
      categoria: form.categoria,
      prioridade: form.prioridade,
      solicitante: form.solicitante || null,
      responsaveis_ids: form.responsaveis_ids,
      equipe_toda: form.equipe_toda,
      criado_por: user?.id,
    });
    if (error) {
      toast.error("Erro ao criar demanda", { description: error.message });
      return;
    }
    toast.success("Demanda criada");
    setOpen(false);
    setForm({ ...form, titulo: "", descricao: "", solicitante: "", responsaveis_ids: [], equipe_toda: false });
    qc.invalidateQueries({ queryKey: ["demandas"] });
    qc.invalidateQueries({ queryKey: ["dash-demandas"] });
    qc.invalidateQueries({ queryKey: ["dash-atribuicoes"] });
  };

  const updateAssignees = async (
    id: string,
    next: { selectedIds: string[]; equipeToda: boolean },
  ) => {
    const { error } = await supabase
      .from("demanda")
      .update({ responsaveis_ids: next.selectedIds, equipe_toda: next.equipeToda })
      .eq("id", id);
    if (error) toast.error("Erro", { description: error.message });
    else {
      qc.invalidateQueries({ queryKey: ["demandas"] });
      qc.invalidateQueries({ queryKey: ["dash-atribuicoes"] });
    }
  };

  const updateStatus = async (id: string, status: (typeof STATUS_OPTS)[number]) => {
    const { error } = await supabase.from("demanda").update({ status }).eq("id", id);
    if (error) toast.error("Erro ao atualizar", { description: error.message });
    else {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["demandas"] });
    }
  };

  return (
    <div>
      <PageHeader
        title="Demandas"
        description="Solicitações recebidas pela equipe — internas, clientes e automações."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Nova demanda
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nova demanda</DialogTitle>
              </DialogHeader>
              <form onSubmit={onSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Título</Label>
                  <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Descrição</Label>
                  <Textarea
                    rows={4}
                    value={form.descricao}
                    onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Origem</Label>
                    <Select value={form.origem} onValueChange={(v) => setForm({ ...form, origem: v as typeof form.origem })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ORIGEM_OPTS.map((o) => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Categoria</Label>
                    <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v as typeof form.categoria })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIA_OPTS.map((o) => <SelectItem key={o} value={o} className="capitalize">{o.replace(/_/g, " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Prioridade</Label>
                    <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v as typeof form.prioridade })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRIORIDADE_OPTS.map((o) => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Solicitante</Label>
                    <Input value={form.solicitante} onChange={(e) => setForm({ ...form, solicitante: e.target.value })} />
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por título..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUS_OPTS.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        {isLoading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : data.length === 0 ? (
          <EmptyState title="Nenhuma demanda ainda" description="Clique em 'Nova demanda' para registrar a primeira." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Atribuído a</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-56">Atribuir / Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.titulo}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{d.categoria.replace(/_/g, " ")}</TableCell>
                  <TableCell>
                    <AssigneeBadges
                      selectedIds={d.responsaveis_ids}
                      equipeToda={d.equipe_toda}
                      options={colabs}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize ${prioridadeVariant(d.prioridade)}`}>{d.prioridade}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize ${statusVariant(d.status)}`}>{d.status.replace(/_/g, " ")}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(d.created_at), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1.5">
                      <AssigneeCombobox
                        options={colabs}
                        selectedIds={d.responsaveis_ids ?? []}
                        equipeToda={!!d.equipe_toda}
                        onChange={(n) => updateAssignees(d.id, n)}
                        placeholder="Atribuir..."
                      />
                      <Select value={d.status} onValueChange={(v) => updateStatus(d.id, v as (typeof STATUS_OPTS)[number])}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTS.map((s) => (
                            <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace(/_/g, " ")}</SelectItem>
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
