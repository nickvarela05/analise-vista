import * as React from "react";
import {
  Loader2,
  Plus,
  UserPlus,
  Briefcase,
  Building2,
  MapPin,
  Type,
  ImagePlus,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DialogHero } from "@/components/shared/DialogHero";
import { DialogSection } from "@/components/shared/DialogSection";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { CargoSelect } from "./CargoSelect";
import { cn } from "@/lib/utils";
import { LOCAL_TRABALHO_LABEL, type LocalTrabalho } from "./lib/types";

export function NovoColaboradorDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [foto, setFoto] = React.useState<File | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<{
    nome: string;
    cargo: string;
    bio: string;
    local_trabalho: LocalTrabalho;
  }>({ nome: "", cargo: "", bio: "", local_trabalho: "escritorio" });

  const previewUrl = React.useMemo(
    () => (foto ? URL.createObjectURL(foto) : null),
    [foto],
  );
  React.useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const iniciais =
    form.nome
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase())
      .join("") || "?";

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setSaving(true);
    let foto_url: string | null = null;
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
      const { data: pub } = supabase.storage
        .from("colaborador-fotos")
        .getPublicUrl(path);
      foto_url = pub.publicUrl;
    }
    const { error } = await supabase.from("colaborador").insert({ ...form, foto_url });
    setSaving(false);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    toast.success("Colaborador adicionado");
    setOpen(false);
    setFoto(null);
    setForm({ nome: "", cargo: "", bio: "", local_trabalho: "escritorio" });
    qc.invalidateQueries({ queryKey: ["equipe"] });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-cyan-500 text-white hover:bg-cyan-600">
          <Plus className="mr-2 h-4 w-4" /> Novo colaborador
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Novo colaborador</DialogTitle>
        </DialogHeader>

        <div className="px-6 pt-6">
          <DialogHero
            icon={UserPlus}
            tone="cyan"
            eyebrow="Equipe"
            title="Novo colaborador"
            description="Cadastre uma nova pessoa no time. Você poderá configurar horário, eventos e férias depois."
          />
        </div>

        <form
          onSubmit={criar}
          className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5"
        >
          <DialogSection title="Identidade" icon={UserIcon}>
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20 ring-4 ring-cyan-500/15">
                {previewUrl && <AvatarImage src={previewUrl} alt={form.nome} />}
                <AvatarFallback className="bg-cyan-500/15 text-lg font-medium text-cyan-700 dark:text-cyan-300">
                  {iniciais}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs">
                  <ImagePlus className="mr-1 inline h-3 w-3" />
                  Foto (opcional)
                </Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
                  className="cursor-pointer file:cursor-pointer focus-visible:ring-cyan-500/40"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Nome completo"
                autoFocus
                className="focus-visible:ring-cyan-500/40"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                <Briefcase className="mr-1 inline h-3 w-3" />
                Cargo
              </Label>
              <CargoSelect
                value={form.cargo}
                onChange={(v) => setForm({ ...form, cargo: v })}
              />
            </div>
          </DialogSection>

          <DialogSection title="Local de trabalho" icon={Building2} variant="tinted">
            <div className="grid grid-cols-2 gap-2">
              {(["escritorio", "rua"] as LocalTrabalho[]).map((local) => {
                const active = form.local_trabalho === local;
                const Icon = local === "escritorio" ? Building2 : MapPin;
                return (
                  <button
                    key={local}
                    type="button"
                    onClick={() => setForm({ ...form, local_trabalho: local })}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border p-3 text-left transition-all",
                      active
                        ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-700 ring-1 ring-cyan-500/30 dark:text-cyan-300"
                        : "border-border bg-card hover:bg-cyan-500/5",
                    )}
                    aria-pressed={active}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-semibold">
                      {LOCAL_TRABALHO_LABEL[local]}
                    </span>
                  </button>
                );
              })}
            </div>
          </DialogSection>

          <DialogSection title="Biografia" icon={Type}>
            <div className="space-y-1.5">
              <Label className="text-xs">Bio (opcional)</Label>
              <Textarea
                rows={3}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="Trajetória, especialidades, gostos..."
                className="resize-none focus-visible:ring-cyan-500/40"
              />
            </div>
          </DialogSection>

          <DialogFooter className="sticky bottom-0 -mx-6 gap-2 border-t bg-card/70 px-6 py-3 backdrop-blur">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-cyan-500 text-white hover:bg-cyan-600"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar colaborador
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
