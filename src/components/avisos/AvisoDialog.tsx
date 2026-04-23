import * as React from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { AvisoRow, AvisoTipo } from "./AvisoCard";

const TIPOS: { value: AvisoTipo; label: string; hint: string }[] = [
  { value: "informativo", label: "Informativo", hint: "Comunicado geral" },
  { value: "alerta", label: "Alerta", hint: "Requer atenção" },
  { value: "critico", label: "Crítico", hint: "Ação imediata" },
];

interface FormState {
  titulo: string;
  mensagem: string;
  tipo: AvisoTipo;
  ativo: boolean;
  destinatarios: string[]; // [] = equipe toda
  expira_em: string; // yyyy-mm-dd | ""
}

const empty: FormState = {
  titulo: "",
  mensagem: "",
  tipo: "informativo",
  ativo: true,
  destinatarios: [],
  expira_em: "",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: AvisoRow | null;
  colabs: { id: string; nome: string }[];
  userId?: string;
  onSaved: () => void;
}

export function AvisoDialog({
  open,
  onOpenChange,
  editing,
  colabs,
  userId,
  onSaved,
}: Props) {
  const [form, setForm] = React.useState<FormState>(empty);
  const [saving, setSaving] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      const ids = new Set<string>();
      if (editing.colaborador_id) ids.add(editing.colaborador_id);
      (editing.colaboradores_ids ?? []).forEach((id) => ids.add(id));
      setForm({
        titulo: editing.titulo,
        mensagem: editing.mensagem,
        tipo: editing.tipo,
        ativo: editing.ativo,
        destinatarios: Array.from(ids),
        expira_em: editing.expira_em ? editing.expira_em.slice(0, 10) : "",
      });
    } else {
      setForm(empty);
    }
  }, [open, editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.mensagem.trim()) {
      toast.error("Preencha título e mensagem");
      return;
    }
    setSaving(true);

    const payload = {
      titulo: form.titulo.trim(),
      mensagem: form.mensagem.trim(),
      tipo: form.tipo,
      ativo: form.ativo,
      colaborador_id: null, // legado, agora usamos colaboradores_ids
      colaboradores_ids: form.destinatarios,
      expira_em: form.expira_em ? new Date(form.expira_em + "T23:59:59").toISOString() : null,
    };

    const { error } = editing
      ? await supabase.from("aviso_gestor").update(payload).eq("id", editing.id)
      : await supabase
          .from("aviso_gestor")
          .insert({ ...payload, criado_por: userId ?? null });

    setSaving(false);

    if (error) {
      toast.error("Não foi possível salvar", { description: error.message });
      return;
    }
    toast.success(editing ? "Aviso atualizado" : "Aviso publicado");
    onSaved();
    onOpenChange(false);
  };

  const colabsMap = React.useMemo(
    () => new Map(colabs.map((c) => [c.id, c.nome])),
    [colabs],
  );

  const toggleDestinatario = (id: string) => {
    setForm((f) => ({
      ...f,
      destinatarios: f.destinatarios.includes(id)
        ? f.destinatarios.filter((x) => x !== id)
        : [...f.destinatarios, id],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar aviso" : "Novo aviso"}</DialogTitle>
          <DialogDescription>
            Comunique a equipe ou pessoas específicas. Avisos críticos aparecem em destaque.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Ex.: Indisponibilidade do sistema X"
              maxLength={120}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mensagem">Mensagem</Label>
            <Textarea
              id="mensagem"
              rows={4}
              value={form.mensagem}
              onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
              placeholder="Detalhe o aviso, instruções e contexto..."
              maxLength={1000}
            />
            <p className="text-right text-[10px] text-muted-foreground">
              {form.mensagem.length}/1000
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Urgência</Label>
              <Select
                value={form.tipo}
                onValueChange={(v) => setForm({ ...form, tipo: v as AvisoTipo })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex flex-col">
                        <span>{t.label}</span>
                        <span className="text-[10px] text-muted-foreground">{t.hint}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expira">Expira em (opcional)</Label>
              <Input
                id="expira"
                type="date"
                value={form.expira_em}
                onChange={(e) => setForm({ ...form, expira_em: e.target.value })}
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Destinatários</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start font-normal"
                >
                  {form.destinatarios.length === 0
                    ? "Equipe toda"
                    : `${form.destinatarios.length} colaborador(es) selecionado(s)`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar colaborador..." />
                  <CommandList>
                    <CommandEmpty>Nenhum encontrado.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        onSelect={() => setForm({ ...form, destinatarios: [] })}
                        className="cursor-pointer"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            form.destinatarios.length === 0 ? "opacity-100" : "opacity-0",
                          )}
                        />
                        Equipe toda
                      </CommandItem>
                      {colabs.map((c) => (
                        <CommandItem
                          key={c.id}
                          onSelect={() => toggleDestinatario(c.id)}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              form.destinatarios.includes(c.id) ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {c.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {form.destinatarios.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {form.destinatarios.map((id) => (
                  <Badge key={id} variant="secondary" className="gap-1 pr-1">
                    {colabsMap.get(id) ?? "—"}
                    <button
                      type="button"
                      onClick={() => toggleDestinatario(id)}
                      className="ml-0.5 rounded-sm hover:bg-muted-foreground/20"
                      aria-label="Remover"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : editing ? "Salvar alterações" : "Publicar aviso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
