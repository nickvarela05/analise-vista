import * as React from "react";
import { Loader2, Plus } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { CargoSelect } from "./CargoSelect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
      const { data: pub } = supabase.storage.from("colaborador-fotos").getPublicUrl(path);
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
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Novo colaborador
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo colaborador</DialogTitle>
        </DialogHeader>
        <form onSubmit={criar} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Cargo</Label>
            <CargoSelect
              value={form.cargo}
              onChange={(v) => setForm({ ...form, cargo: v })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Local de trabalho</Label>
            <Select
              value={form.local_trabalho}
              onValueChange={(v) => setForm({ ...form, local_trabalho: v as LocalTrabalho })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="escritorio">{LOCAL_TRABALHO_LABEL.escritorio}</SelectItem>
                <SelectItem value="rua">{LOCAL_TRABALHO_LABEL.rua}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Bio</Label>
            <Textarea
              rows={3}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Foto</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
