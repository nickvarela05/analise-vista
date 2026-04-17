import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

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

function prioCor(p: string) {
  if (p === "alta") return "bg-destructive";
  if (p === "media") return "bg-warning";
  return "bg-success";
}

function Tarefas() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [novo, setNovo] = React.useState("");
  const [prio, setPrio] = React.useState<"baixa" | "media" | "alta">("media");

  const { data = [], isLoading } = useQuery({
    queryKey: ["tarefas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("todo")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const adicionar = async () => {
    if (!novo.trim()) return;
    const { error } = await supabase.from("todo").insert({
      titulo: novo.trim(),
      prioridade: prio,
      criado_por: user?.id,
      responsavel_id: user?.id,
    });
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    setNovo("");
    qc.invalidateQueries({ queryKey: ["tarefas"] });
    qc.invalidateQueries({ queryKey: ["dash-tarefas"] });
  };

  const toggle = async (id: string, concluida: boolean) => {
    const { error } = await supabase
      .from("todo")
      .update({
        status: concluida ? "concluida" : "pendente",
        concluida_em: concluida ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (error) toast.error("Erro", { description: error.message });
    else {
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      qc.invalidateQueries({ queryKey: ["dash-tarefas"] });
    }
  };

  const remover = async (id: string) => {
    const { error } = await supabase.from("todo").delete().eq("id", id);
    if (error) toast.error("Erro", { description: error.message });
    else {
      toast.success("Tarefa removida");
      qc.invalidateQueries({ queryKey: ["tarefas"] });
    }
  };

  return (
    <div>
      <PageHeader title="Tarefas" description="Suas tarefas semanais e diárias." />

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="O que precisa ser feito?"
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionar()}
            className="flex-1 min-w-[240px]"
          />
          <Select value={prio} onValueChange={(v) => setPrio(v as typeof prio)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="baixa">Baixa</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={adicionar}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar
          </Button>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : data.length === 0 ? (
          <EmptyState title="Nenhuma tarefa cadastrada" description="Adicione tarefas para se organizar." />
        ) : (
          <ul className="divide-y divide-border">
            {data.map((t) => {
              const done = t.status === "concluida";
              return (
                <li key={t.id} className="flex items-center gap-3 p-3 hover:bg-muted/30">
                  <Checkbox checked={done} onCheckedChange={(v) => toggle(t.id, !!v)} />
                  <span className={`h-2 w-2 rounded-full ${prioCor(t.prioridade)}`} />
                  <span className={`flex-1 text-sm ${done ? "text-muted-foreground line-through" : ""}`}>
                    {t.titulo}
                  </span>
                  <Badge variant="outline" className="capitalize text-[10px]">{t.status.replace(/_/g, " ")}</Badge>
                  <Button variant="ghost" size="icon" onClick={() => remover(t.id)} className="h-7 w-7">
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
