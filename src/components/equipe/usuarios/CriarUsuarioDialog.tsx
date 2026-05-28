import * as React from "react";
import { Loader2, UserPlus, Mail, Briefcase, Shield, Link2, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CargoSelect } from "@/components/equipe/CargoSelect";
import { adminFetch } from "@/lib/admin-fetch";
import type { Colaborador } from "@/components/equipe/lib/types";
import type { Role, TempPasswordInfo } from "./types";

interface FormState {
  email: string;
  nome: string;
  cargo: string;
  role: Role;
  colaborador_id: string;
}

const initialForm: FormState = {
  email: "",
  nome: "",
  cargo: "",
  role: "analista",
  colaborador_id: "__none__",
};

export function CriarUsuarioDialog({
  colabs,
  onCreated,
}: {
  colabs: Colaborador[];
  onCreated: (info: TempPasswordInfo) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(initialForm);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim() || !form.nome.trim()) return;
    setSaving(true);
    try {
      const r = await adminFetch<{ ok: true; user_id: string; temp_password: string }>(
        "/api/admin/usuarios?action=create",
        {
          method: "POST",
          body: JSON.stringify({
            email: form.email.trim(),
            nome: form.nome.trim(),
            role: form.role,
            colaborador_id: form.colaborador_id === "__none__" ? null : form.colaborador_id,
          }),
        },
      );
      setOpen(false);
      onCreated({ email: form.email.trim(), password: r.temp_password, context: "create" });
      setForm(initialForm);
    } catch (e2) {
      toast.error("Erro ao criar usuário", { description: (e2 as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-cyan-500 text-white hover:bg-cyan-600">
          <UserPlus className="mr-2 h-4 w-4" /> Novo usuário
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Criar novo usuário</DialogTitle>
        </DialogHeader>

        <div className="px-6 pt-6">
          <DialogHero
            icon={UserPlus}
            tone="cyan"
            eyebrow="Equipe · Usuários"
            title="Criar novo usuário"
            description="Uma senha temporária será gerada e exibida apenas uma vez. No primeiro acesso, o usuário definirá a senha definitiva."
          />
        </div>

        <form onSubmit={submit} className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
          <DialogSection title="Dados pessoais" icon={UserIcon}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  required
                  className="focus-visible:ring-cyan-500/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  <Mail className="mr-1 inline h-3 w-3" />
                  E-mail
                </Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  placeholder="pessoa@empresa.com"
                  className="focus-visible:ring-cyan-500/40"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                <Briefcase className="mr-1 inline h-3 w-3" />
                Cargo (sugestão)
              </Label>
              <CargoSelect value={form.cargo} onChange={(v) => setForm({ ...form, cargo: v })} />
              <p className="text-[11px] text-muted-foreground">
                O cargo é definido no perfil do colaborador vinculado.
              </p>
            </div>
          </DialogSection>

          <DialogSection title="Acesso e vínculo" icon={Shield} variant="tinted">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  <Shield className="mr-1 inline h-3 w-3" />
                  Grupo de acesso
                </Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm({ ...form, role: v as Role })}
                >
                  <SelectTrigger className="focus-visible:ring-cyan-500/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="analista">Analista</SelectItem>
                    <SelectItem value="gestor">Gestor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  <Link2 className="mr-1 inline h-3 w-3" />
                  Vincular colaborador
                </Label>
                <Select
                  value={form.colaborador_id}
                  onValueChange={(v) => {
                    if (v === "__none__") {
                      setForm({ ...form, colaborador_id: v });
                      return;
                    }
                    const c = colabs.find((x) => x.id === v);
                    if (c) {
                      setForm({
                        ...form,
                        colaborador_id: v,
                        nome: c.nome ?? form.nome,
                        cargo: c.cargo ?? form.cargo,
                      });
                      toast.success("Dados do colaborador preenchidos", {
                        description: "Nome e cargo foram migrados automaticamente.",
                      });
                    } else {
                      setForm({ ...form, colaborador_id: v });
                    }
                  }}
                >
                  <SelectTrigger className="focus-visible:ring-cyan-500/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Nenhum —</SelectItem>
                    {colabs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Criar e gerar senha
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
