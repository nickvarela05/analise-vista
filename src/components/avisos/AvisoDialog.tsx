import * as React from "react";
import {
  Check,
  X,
  Megaphone,
  AlertTriangle,
  AlertCircle,
  Info,
  Users,
  CalendarClock,
  Type,
  MessageSquare,
} from "lucide-react";
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
import { DialogHero } from "@/components/shared/DialogHero";
import { DialogSection } from "@/components/shared/DialogSection";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { StatTone } from "@/components/shared/StatPill";
import type { AvisoRow, AvisoTipo } from "./AvisoCard";

type TipoMeta = {
  value: AvisoTipo;
  label: string;
  hint: string;
  Icon: LucideIcon;
  tone: StatTone;
  active: string;
  idle: string;
};

const TIPOS: TipoMeta[] = [
  {
    value: "informativo",
    label: "Informativo",
    hint: "Comunicado geral",
    Icon: Info,
    tone: "sky",
    active:
      "border-sky-500/60 bg-sky-500/10 text-sky-700 ring-1 ring-sky-500/30 dark:text-sky-300",
    idle: "border-border bg-card hover:bg-sky-500/5",
  },
  {
    value: "alerta",
    label: "Alerta",
    hint: "Requer atenção",
    Icon: AlertCircle,
    tone: "amber",
    active:
      "border-amber-500/60 bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-300",
    idle: "border-border bg-card hover:bg-amber-500/5",
  },
  {
    value: "critico",
    label: "Crítico",
    hint: "Ação imediata",
    Icon: AlertTriangle,
    tone: "destructive",
    active:
      "border-destructive/60 bg-destructive/10 text-destructive ring-1 ring-destructive/30",
    idle: "border-border bg-card hover:bg-destructive/5",
  },
];

interface FormState {
  titulo: string;
  mensagem: string;
  tipo: AvisoTipo;
  ativo: boolean;
  destinatarios: string[]; // [] = equipe toda
  expira_em: string;
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

  const tipoMeta = TIPOS.find((t) => t.value === form.tipo)!;
  const heroTone: StatTone = tipoMeta.tone;

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
      colaborador_id: null,
      colaboradores_ids: form.destinatarios,
      expira_em: form.expira_em
        ? new Date(form.expira_em + "T23:59:59").toISOString()
        : null,
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

  const destinatariosLabel =
    form.destinatarios.length === 0
      ? "Equipe toda"
      : `${form.destinatarios.length} colaborador(es) selecionado(s)`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{editing ? "Editar aviso" : "Novo aviso"}</DialogTitle>
        </DialogHeader>

        <div className="px-6 pt-6">
          <DialogHero
            icon={Megaphone}
            tone={heroTone}
            eyebrow={editing ? "Editar comunicado" : "Novo comunicado"}
            title={editing ? "Editar aviso" : "Novo aviso"}
            description="Comunique a equipe ou pessoas específicas. Avisos críticos aparecem em destaque no feed e no sino."
            chips={
              <>
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1 text-[10px]",
                    heroTone === "destructive" &&
                      "border-destructive/40 bg-destructive/10 text-destructive",
                    heroTone === "amber" &&
                      "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                    heroTone === "sky" &&
                      "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
                  )}
                >
                  <tipoMeta.Icon className="h-3 w-3" />
                  {tipoMeta.label}
                </Badge>
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <Users className="h-3 w-3" />
                  {destinatariosLabel}
                </Badge>
                {form.expira_em && (
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    <CalendarClock className="h-3 w-3" />
                    Expira {form.expira_em}
                  </Badge>
                )}
              </>
            }
          />
        </div>

        <form
          onSubmit={submit}
          className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5"
        >
          <DialogSection title="Urgência" icon={AlertTriangle}>
            <div className="grid grid-cols-3 gap-2">
              {TIPOS.map((t) => {
                const active = form.tipo === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm({ ...form, tipo: t.value })}
                    className={cn(
                      "group flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all",
                      active ? t.active : t.idle,
                    )}
                    aria-pressed={active}
                  >
                    <div className="flex items-center gap-1.5">
                      <t.Icon className="h-3.5 w-3.5" />
                      <span className="text-xs font-semibold">{t.label}</span>
                    </div>
                    <span className="text-[10.5px] text-muted-foreground">
                      {t.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </DialogSection>

          <DialogSection title="Conteúdo" icon={Type}>
            <div className="space-y-1.5">
              <Label htmlFor="titulo" className="text-xs">
                Título
              </Label>
              <Input
                id="titulo"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ex.: Indisponibilidade do sistema X"
                maxLength={120}
                autoFocus
                className="focus-visible:ring-amber-500/40"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mensagem" className="text-xs">
                <MessageSquare className="mr-1 inline h-3 w-3" />
                Mensagem
              </Label>
              <Textarea
                id="mensagem"
                rows={5}
                value={form.mensagem}
                onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
                placeholder="Detalhe o aviso, instruções e contexto..."
                maxLength={1000}
                className="resize-none focus-visible:ring-amber-500/40"
              />
              <p className="text-right text-[10px] tabular-nums text-muted-foreground">
                {form.mensagem.length}/1000
              </p>
            </div>
          </DialogSection>

          <DialogSection title="Distribuição" icon={Users} variant="tinted">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Destinatários</Label>
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start font-normal"
                    >
                      <Users className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                      {destinatariosLabel}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] p-0"
                    align="start"
                  >
                    <Command>
                      <CommandInput placeholder="Buscar colaborador..." />
                      <CommandList>
                        <CommandEmpty>Nenhum encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            onSelect={() =>
                              setForm({ ...form, destinatarios: [] })
                            }
                            className="cursor-pointer"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                form.destinatarios.length === 0
                                  ? "opacity-100"
                                  : "opacity-0",
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
                                  form.destinatarios.includes(c.id)
                                    ? "opacity-100"
                                    : "opacity-0",
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
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="expira" className="text-xs">
                  <CalendarClock className="mr-1 inline h-3 w-3" />
                  Expira em (opcional)
                </Label>
                <Input
                  id="expira"
                  type="date"
                  value={form.expira_em}
                  onChange={(e) =>
                    setForm({ ...form, expira_em: e.target.value })
                  }
                  min={new Date().toISOString().slice(0, 10)}
                  className="focus-visible:ring-amber-500/40"
                />
              </div>
            </div>

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
          </DialogSection>

          <DialogFooter className="sticky bottom-0 -mx-6 gap-2 border-t bg-card/70 px-6 py-3 backdrop-blur">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className={cn(
                heroTone === "destructive" &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                heroTone === "amber" &&
                  "bg-amber-500 text-white hover:bg-amber-600",
                heroTone === "sky" && "bg-sky-500 text-white hover:bg-sky-600",
              )}
            >
              {saving
                ? "Salvando..."
                : editing
                  ? "Salvar alterações"
                  : "Publicar aviso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
