import * as React from "react";
import { format } from "date-fns";
import { Plus, Trash2, Loader2, Clock, Plane, AlertTriangle, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import type { Colaborador } from "./lib/types";
import { DIAS, EVENTO_LABEL } from "./lib/types";
import { HorarioDialog } from "./HorarioDialog";
import { FeriasDialog } from "./FeriasDialog";
import { CargoSelect } from "./CargoSelect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LOCAL_TRABALHO_LABEL, type LocalTrabalho } from "./lib/types";

interface Props {
  colab: Colaborador | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ColaboradorDrawer({ colab, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [openH, setOpenH] = React.useState(false);
  const [openF, setOpenF] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [foto, setFoto] = React.useState<File | null>(null);
  const [form, setForm] = React.useState<{
    nome: string;
    cargo: string;
    email: string;
    bio: string;
    local_trabalho: LocalTrabalho;
  }>({ nome: "", cargo: "", email: "", bio: "", local_trabalho: "escritorio" });

  React.useEffect(() => {
    if (colab) {
      setForm({
        nome: colab.nome,
        cargo: colab.cargo ?? "",
        email: colab.email ?? "",
        bio: colab.bio ?? "",
        local_trabalho: (colab.local_trabalho ?? "escritorio") as LocalTrabalho,
      });
      setEditing(false);
      setFoto(null);
    }
  }, [colab]);

  if (!colab) return null;

  const horarios = [...(colab.colaborador_horario ?? [])].sort(
    (a, b) => a.dia_semana - b.dia_semana,
  );
  const ferias = colab.colaborador_ferias ?? [];
  const eventos = [...(colab.colaborador_evento ?? [])].sort((a, b) =>
    b.data.localeCompare(a.data),
  );

  const salvar = async () => {
    setSaving(true);
    let foto_url = colab.foto_url;
    if (foto) {
      const path = `team/${Date.now()}-${foto.name}`;
      const { error: upErr } = await supabase.storage
        .from("colaborador-fotos")
        .upload(path, foto);
      if (upErr) {
        setSaving(false);
        toast.error("Erro no upload", { description: upErr.message });
        return;
      }
      foto_url = supabase.storage.from("colaborador-fotos").getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase
      .from("colaborador")
      .update({ ...form, foto_url })
      .eq("id", colab.id);
    setSaving(false);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    toast.success("Atualizado");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["equipe"] });
  };

  const desativar = async () => {
    if (!confirm("Desativar este colaborador?")) return;
    const { error } = await supabase
      .from("colaborador")
      .update({ ativo: false })
      .eq("id", colab.id);
    if (error) toast.error("Erro", { description: error.message });
    else {
      toast.success("Colaborador desativado");
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["equipe"] });
    }
  };

  const removerEvento = async (id: string) => {
    const { error } = await supabase.from("colaborador_evento").delete().eq("id", id);
    if (error) toast.error("Erro", { description: error.message });
    else qc.invalidateQueries({ queryKey: ["equipe"] });
  };

  const removerFerias = async (id: string) => {
    const { error } = await supabase.from("colaborador_ferias").delete().eq("id", id);
    if (error) toast.error("Erro", { description: error.message });
    else qc.invalidateQueries({ queryKey: ["equipe"] });
  };

  const removerHorario = async (id: string) => {
    const { error } = await supabase.from("colaborador_horario").delete().eq("id", id);
    if (error) toast.error("Erro", { description: error.message });
    else qc.invalidateQueries({ queryKey: ["equipe"] });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-lg">
        <SheetHeader className="space-y-1">
          <SheetTitle>Colaborador</SheetTitle>
          <SheetDescription>
            Informações, horário, eventos e férias.
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-start gap-4">
          <Avatar className="h-20 w-20 ring-2 ring-primary/20">
            {colab.foto_url && <AvatarImage src={colab.foto_url} />}
            <AvatarFallback className="bg-primary/10 text-primary">
              {colab.nome
                .split(" ")
                .slice(0, 2)
                .map((n) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-1">
            {editing ? (
              <>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Nome"
                  className="h-8"
                />
                <CargoSelect
                  value={form.cargo}
                  onChange={(v) => setForm({ ...form, cargo: v })}
                />
                <Input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="E-mail"
                  className="h-8"
                />
                <Select
                  value={form.local_trabalho}
                  onValueChange={(v) => setForm({ ...form, local_trabalho: v as LocalTrabalho })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="escritorio">{LOCAL_TRABALHO_LABEL.escritorio}</SelectItem>
                    <SelectItem value="rua">{LOCAL_TRABALHO_LABEL.rua}</SelectItem>
                  </SelectContent>
                </Select>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold leading-tight">{colab.nome}</h3>
                {colab.cargo && (
                  <p className="text-sm text-muted-foreground">{colab.cargo}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {LOCAL_TRABALHO_LABEL[(colab.local_trabalho ?? "escritorio") as LocalTrabalho]}
                </p>
                {colab.email && (
                  <p className="text-xs text-muted-foreground">{colab.email}</p>
                )}
              </>
            )}
          </div>
        </div>

        {editing && (
          <div className="space-y-1.5">
            <Label className="text-xs">Trocar foto</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {editing ? (
            <>
              <Button size="sm" onClick={salvar} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Salvar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                Editar
              </Button>
              <Button size="sm" variant="ghost" onClick={desativar}>
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Desativar
              </Button>
            </>
          )}
        </div>

        <Tabs defaultValue="horario" className="mt-2">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="horario">
              <Clock className="mr-1 h-3.5 w-3.5" />
              Horário
            </TabsTrigger>
            <TabsTrigger value="eventos">
              <AlertTriangle className="mr-1 h-3.5 w-3.5" />
              Eventos
            </TabsTrigger>
            <TabsTrigger value="ferias">
              <Plane className="mr-1 h-3.5 w-3.5" />
              Férias
            </TabsTrigger>
            <TabsTrigger value="bio">
              <UserIcon className="mr-1 h-3.5 w-3.5" />
              Bio
            </TabsTrigger>
          </TabsList>

          <TabsContent value="horario" className="mt-3 space-y-2">
            {horarios.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem horários cadastrados.</p>
            ) : (
              <div className="space-y-1">
                {horarios.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5 text-xs"
                  >
                    <span className="font-medium">{DIAS[h.dia_semana]}</span>
                    <span className="flex-1 text-muted-foreground">
                      Exp. {h.expediente_inicio?.slice(0, 5) ?? "—"}–
                      {h.expediente_fim?.slice(0, 5) ?? "—"}
                      {h.almoco_inicio &&
                        ` · Almoço ${h.almoco_inicio.slice(0, 5)}–${h.almoco_fim?.slice(0, 5)}`}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removerHorario(h.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => setOpenH(true)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar horário
            </Button>
            <HorarioDialog
              open={openH}
              onOpenChange={setOpenH}
              colaboradorId={colab.id}
              onSaved={() => qc.invalidateQueries({ queryKey: ["equipe"] })}
            />
          </TabsContent>

          <TabsContent value="eventos" className="mt-3 space-y-2">
            {eventos.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem eventos registrados.</p>
            ) : (
              <div className="space-y-1">
                {eventos.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-start justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5 text-xs"
                  >
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {EVENTO_LABEL[e.tipo]}
                        </Badge>
                        <span className="font-medium">
                          {format(new Date(e.data + "T00:00:00"), "dd/MM/yyyy")}
                        </span>
                        {e.tipo === "atraso" && e.hora_inicio && (
                          <span className="text-muted-foreground">
                            {e.hora_inicio.slice(0, 5)}–{e.hora_fim?.slice(0, 5) ?? "?"}
                          </span>
                        )}
                      </div>
                      {e.observacao && (
                        <p className="text-muted-foreground">{e.observacao}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removerEvento(e.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Para registrar novos eventos, use a aba <strong>Calendário</strong>.
            </p>
          </TabsContent>

          <TabsContent value="ferias" className="mt-3 space-y-2">
            {ferias.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem férias programadas.</p>
            ) : (
              <div className="space-y-1">
                {ferias.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5 text-xs"
                  >
                    <div className="flex-1">
                      <span className="font-medium">
                        {format(new Date(f.data_inicio + "T00:00:00"), "dd/MM/yyyy")} –{" "}
                        {format(new Date(f.data_fim + "T00:00:00"), "dd/MM/yyyy")}
                      </span>
                      {f.observacao && (
                        <span className="ml-2 text-muted-foreground">{f.observacao}</span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removerFerias(f.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => setOpenF(true)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar período
            </Button>
            <FeriasDialog
              open={openF}
              onOpenChange={setOpenF}
              colaboradorId={colab.id}
              onSaved={() => qc.invalidateQueries({ queryKey: ["equipe"] })}
            />
          </TabsContent>

          <TabsContent value="bio" className="mt-3">
            {editing ? (
              <Textarea
                rows={5}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            ) : (
              <p className="text-xs text-muted-foreground whitespace-pre-line">
                {colab.bio || "Sem bio cadastrada."}
              </p>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
