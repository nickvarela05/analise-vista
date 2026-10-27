import * as React from "react";
import { toast } from "sonner";
import { CalendarDays, Loader2 } from "lucide-react";
import type { z } from "zod";
import { processoSchema } from "@/lib/schemas/processo";

import { DialogHero } from "@/components/shared/DialogHero";
import { DialogSection } from "@/components/shared/DialogSection";
import { AssigneeCombobox, type AssigneeOption } from "@/components/AssigneeCombobox";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  COR_OPTIONS,
  STATUS_LABEL,
  type CorProcesso,
  type Processo,
  type ProcessoStatus,
  type ProcessoVinculo,
} from "@/components/processos/processos-lib";

// ---------- Dialog ----------

type ProcessoForm = z.infer<typeof processoSchema>;

function makeInitial(editing: Processo | null): ProcessoForm {
  return {
    nome: editing?.nome ?? "",
    descricao: editing?.descricao ?? null,
    cor: editing?.cor ?? "indigo",
    previsto_inicio: editing?.previsto_inicio ?? null,
    previsto_fim: editing?.previsto_fim ?? null,
    real_inicio: editing?.real_inicio ?? null,
    real_fim: editing?.real_fim ?? null,
    responsaveis_ids: editing?.responsaveis_ids ?? [],
    equipe_toda: editing?.equipe_toda ?? false,
    status: editing?.status ?? "planejado",
    alerta_dias_antes: editing?.alerta_dias_antes ?? 14,
    observacoes: editing?.observacoes ?? null,
  };
}

export function ProcessoDialog({
  open,
  onOpenChange,
  editing,
  ano,
  userId,
  assigneeOptions,
  tarefasMini,
  demandasMini,
  vinculosDoProcesso,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Processo | null;
  ano: number;
  userId: string | null;
  assigneeOptions: AssigneeOption[];
  tarefasMini: { id: string; titulo: string }[];
  demandasMini: { id: string; titulo: string }[];
  vinculosDoProcesso: ProcessoVinculo[];
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState<ProcessoForm>(() => makeInitial(editing));
  const [tarefaIds, setTarefaIds] = React.useState<string[]>([]);
  const [demandaIds, setDemandaIds] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

  const vinculosRef = React.useRef(vinculosDoProcesso);
  vinculosRef.current = vinculosDoProcesso;
  React.useEffect(() => {
    if (open) {
      const v = vinculosRef.current;
      setForm(makeInitial(editing));
      setTarefaIds(v.filter((x) => x.tipo === "tarefa").map((x) => x.ref_id));
      setDemandaIds(v.filter((x) => x.tipo === "demanda").map((x) => x.ref_id));
    }
    // Only reinitialize when the dialog opens or the target row changes —
    // never when the parent re-renders with a new vinculos array reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  const setField = <K extends keyof ProcessoForm>(k: K, v: ProcessoForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const salvar = async () => {
    const parsed = processoSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...parsed.data,
        ano,
        criado_por: editing ? undefined : userId,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;

      let processoId: string;
      if (editing) {
        const { error } = await db.from("processo_anual").update(payload).eq("id", editing.id);
        if (error) throw error;
        processoId = editing.id;
      } else {
        const { data, error } = await db
          .from("processo_anual")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        processoId = (data as { id: string }).id;
      }

      const { error: delErr } = await db
        .from("processo_anual_vinculo")
        .delete()
        .eq("processo_id", processoId);
      if (delErr) throw delErr;

      const novos = [
        ...tarefaIds.map((ref_id) => ({
          processo_id: processoId,
          tipo: "tarefa" as const,
          ref_id,
        })),
        ...demandaIds.map((ref_id) => ({
          processo_id: processoId,
          tipo: "demanda" as const,
          ref_id,
        })),
      ];
      if (novos.length > 0) {
        const { error: insErr } = await db.from("processo_anual_vinculo").insert(novos);
        if (insErr) throw insErr;
      }

      toast.success(editing ? "Processo atualizado" : "Processo criado");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Erro ao salvar: " + msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHero
          icon={CalendarDays}
          tone="indigo"
          title={editing ? "Editar processo" : "Novo processo"}
          description={`Ano ${ano} — defina os períodos previsto e real, responsáveis e vínculos.`}
        />

        <div className="space-y-5">
          <DialogSection title="Identificação">
            <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setField("nome", e.target.value)}
                  placeholder="Ex: Fechamento contábil, Auditoria..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cor</Label>
                <Select value={form.cor} onValueChange={(v) => setField("cor", v as CorProcesso)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COR_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        <span className="flex items-center gap-2">
                          <span className={cn("h-3 w-3 rounded-full", c.swatch)} />
                          {c.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                value={form.descricao ?? ""}
                onChange={(e) => setField("descricao", e.target.value || null)}
                rows={2}
                placeholder="Contexto ou detalhes do processo"
              />
            </div>
          </DialogSection>

          <DialogSection title="Períodos">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Previsto
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Início</Label>
                    <Input
                      type="date"
                      value={form.previsto_inicio ?? ""}
                      onChange={(e) => setField("previsto_inicio", e.target.value || null)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fim</Label>
                    <Input
                      type="date"
                      value={form.previsto_fim ?? ""}
                      onChange={(e) => setField("previsto_fim", e.target.value || null)}
                    />
                  </div>
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Real
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Início</Label>
                    <Input
                      type="date"
                      value={form.real_inicio ?? ""}
                      onChange={(e) => setField("real_inicio", e.target.value || null)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fim</Label>
                    <Input
                      type="date"
                      value={form.real_fim ?? ""}
                      onChange={(e) => setField("real_fim", e.target.value || null)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </DialogSection>

          <DialogSection title="Atribuição & alertas">
            <div className="grid gap-3 sm:grid-cols-[1fr_160px_160px]">
              <div className="space-y-1.5">
                <Label>Responsáveis</Label>
                <AssigneeCombobox
                  options={assigneeOptions}
                  selectedIds={form.responsaveis_ids}
                  equipeToda={form.equipe_toda}
                  onChange={({ selectedIds, equipeToda }) => {
                    setField("responsaveis_ids", selectedIds);
                    setField("equipe_toda", equipeToda);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setField("status", v as ProcessoStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABEL) as ProcessoStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Alerta (dias antes)</Label>
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={form.alerta_dias_antes}
                  onChange={(e) =>
                    setField("alerta_dias_antes", Math.max(0, Number(e.target.value) || 0))
                  }
                />
              </div>
            </div>
          </DialogSection>

          <DialogSection title="Vínculos">
            <div className="grid gap-3 sm:grid-cols-2">
              <MultiSelectSimples
                label="Tarefas"
                options={tarefasMini}
                selected={tarefaIds}
                onChange={setTarefaIds}
              />
              <MultiSelectSimples
                label="Demandas"
                options={demandasMini}
                selected={demandaIds}
                onChange={setDemandaIds}
              />
            </div>
          </DialogSection>

          <DialogSection title="Observações">
            <Textarea
              value={form.observacoes ?? ""}
              onChange={(e) => setField("observacoes", e.target.value || null)}
              rows={3}
              placeholder="Notas internas, riscos, checklist..."
            />
          </DialogSection>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Multi-select simples (busca por texto) ----------

function MultiSelectSimples({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { id: string; titulo: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [busca, setBusca] = React.useState("");
  const selectedSet = new Set(selected);
  const filtrado = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = options.filter((o) => !selectedSet.has(o.id));
    if (!q) return base.slice(0, 30);
    return base.filter((o) => o.titulo.toLowerCase().includes(q)).slice(0, 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, options, selected]);

  const optionMap = new Map(options.map((o) => [o.id, o.titulo]));

  const toggle = (id: string) => {
    if (selectedSet.has(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        placeholder={`Buscar ${label.toLowerCase()}...`}
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((id) => (
            <Badge key={id} variant="secondary" className="gap-1 text-[10px]">
              {optionMap.get(id) ?? "(removido)"}
              <button
                type="button"
                onClick={() => toggle(id)}
                aria-label="Remover"
                className="ml-0.5 opacity-60 hover:opacity-100"
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      )}
      {busca && (
        <div className="max-h-40 overflow-y-auto rounded-md border">
          {filtrado.length === 0 ? (
            <p className="p-2 text-xs text-muted-foreground">Nenhum resultado</p>
          ) : (
            filtrado.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => toggle(o.id)}
                className="block w-full truncate px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                {o.titulo}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
