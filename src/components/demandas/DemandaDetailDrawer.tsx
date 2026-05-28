import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Edit2,
  ExternalLink,
  Inbox,
  ListChecks,
  Loader2,
  Plus,
  Tag,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { DialogHero } from "@/components/shared/DialogHero";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AssigneeCombobox, type AssigneeOption } from "@/components/AssigneeCombobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  STATUS_OPTS,
  STATUS_LABEL,
  describePrazo,
  prazoBadgeClass,
  prioridadeBadgeClass,
  statusBadgeClass,
  type DemandaStatus,
} from "./lib/demanda-utils";

interface DemandaDetail {
  id: string;
  titulo: string;
  descricao?: string | null;
  origem: string;
  categoria: string;
  prioridade: string;
  status: string;
  prazo?: string | null;
  tags?: string[] | null;
  solicitante?: string | null;
  responsaveis_ids: string[];
  equipe_toda: boolean;
  created_at: string;
  updated_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  demanda: DemandaDetail | null;
  colabs: AssigneeOption[];
  onEdit: () => void;
  onCreateTarefa: () => void;
  onChanged: () => void;
}

export function DemandaDetailDrawer({
  open,
  onOpenChange,
  demanda,
  colabs,
  onEdit,
  onCreateTarefa,
  onChanged,
}: Props) {
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const { data: tarefas = [] } = useQuery({
    queryKey: ["demanda-tarefas", demanda?.id],
    queryFn: async () => {
      if (!demanda?.id) return [];
      const { data, error } = await supabase
        .from("todo")
        .select("id, titulo, status, prioridade, data_prevista, responsaveis_ids, equipe_toda")
        .eq("demanda_id", demanda.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!demanda?.id && open,
  });

  if (!demanda) return null;

  const prazo = describePrazo(demanda.prazo, demanda.status);

  const updateStatus = async (status: DemandaStatus) => {
    const { error } = await supabase.from("demanda").update({ status }).eq("id", demanda.id);
    if (error) toast.error("Erro ao atualizar", { description: error.message });
    else {
      toast.success("Status atualizado");
      onChanged();
    }
  };

  const updateAssignees = async (next: { selectedIds: string[]; equipeToda: boolean }) => {
    const { error } = await supabase
      .from("demanda")
      .update({ responsaveis_ids: next.selectedIds, equipe_toda: next.equipeToda })
      .eq("id", demanda.id);
    if (error) toast.error("Erro", { description: error.message });
    else onChanged();
  };

  const handleDelete = async () => {
    const { error } = await supabase.from("demanda").delete().eq("id", demanda.id);
    if (error) {
      toast.error("Erro ao excluir", { description: error.message });
      return;
    }
    toast.success("Demanda excluída");
    setConfirmDelete(false);
    onOpenChange(false);
    onChanged();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <SheetTitle className="text-lg leading-snug pr-4">{demanda.titulo}</SheetTitle>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className={cn("capitalize", prioridadeBadgeClass(demanda.prioridade))}>
                {demanda.prioridade}
              </Badge>
              <Badge variant="outline" className={cn("capitalize", statusBadgeClass(demanda.status))}>
                {STATUS_LABEL[demanda.status as DemandaStatus] ?? demanda.status}
              </Badge>
              <Badge variant="outline" className="capitalize text-muted-foreground">
                {demanda.categoria.replace(/_/g, " ")}
              </Badge>
              <Badge variant="outline" className="capitalize text-muted-foreground">
                origem: {demanda.origem}
              </Badge>
              {prazo && (
                <Badge variant="outline" className={cn("gap-1", prazoBadgeClass(prazo.tone))}>
                  <Calendar className="h-3 w-3" />
                  {prazo.label}
                </Badge>
              )}
            </div>
            <SheetDescription className="sr-only">Detalhes da demanda</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Ações rápidas */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Edit2 className="mr-1.5 h-3.5 w-3.5" /> Editar
              </Button>
              <Button size="sm" variant="outline" onClick={onCreateTarefa}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Criar tarefa
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir
              </Button>
            </div>

            {/* Status & Atribuição rápidas */}
            <div className="grid grid-cols-1 gap-4 rounded-lg border bg-muted/20 p-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <Select value={demanda.status} onValueChange={(v) => updateStatus(v as DemandaStatus)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTS.map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Responsáveis</label>
                <AssigneeCombobox
                  options={colabs}
                  selectedIds={demanda.responsaveis_ids}
                  equipeToda={demanda.equipe_toda}
                  onChange={updateAssignees}
                />
              </div>
            </div>

            {/* Descrição */}
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Descrição
              </h4>
              {demanda.descricao ? (
                <p className="whitespace-pre-wrap text-sm text-foreground">{demanda.descricao}</p>
              ) : (
                <p className="text-sm italic text-muted-foreground">Sem descrição.</p>
              )}
            </section>

            {/* Metadados */}
            <section className="grid grid-cols-2 gap-3 text-xs">
              {demanda.solicitante && (
                <div>
                  <p className="font-semibold uppercase tracking-wide text-muted-foreground">Solicitante</p>
                  <p className="mt-0.5 flex items-center gap-1 text-foreground">
                    <User className="h-3 w-3" /> {demanda.solicitante}
                  </p>
                </div>
              )}
              <div>
                <p className="font-semibold uppercase tracking-wide text-muted-foreground">Criada em</p>
                <p className="mt-0.5 text-foreground">
                  {format(new Date(demanda.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
              <div>
                <p className="font-semibold uppercase tracking-wide text-muted-foreground">Última atualização</p>
                <p className="mt-0.5 text-foreground">
                  {format(new Date(demanda.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            </section>

            {/* Tags */}
            {demanda.tags && demanda.tags.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</h4>
                <div className="flex flex-wrap gap-1">
                  {demanda.tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      <Tag className="h-3 w-3" /> {t}
                    </span>
                  ))}
                </div>
              </section>
            )}

            <Separator />

            {/* Tarefas vinculadas */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <ListChecks className="h-3.5 w-3.5" />
                  Tarefas vinculadas ({tarefas.length})
                </h4>
                <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                  <Link to="/tarefas">Ver todas <ExternalLink className="ml-1 h-3 w-3" /></Link>
                </Button>
              </div>
              {tarefas.length === 0 ? (
                <p className="text-sm italic text-muted-foreground">
                  Nenhuma tarefa vinculada. Use "Criar tarefa" acima para gerar uma.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {tarefas.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2"
                    >
                      <span className="truncate text-sm">{t.titulo}</span>
                      <Badge variant="outline" className="capitalize text-[10px]">{t.status.replace(/_/g, " ")}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir demanda?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. As tarefas vinculadas continuarão existindo, mas perderão a referência.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
