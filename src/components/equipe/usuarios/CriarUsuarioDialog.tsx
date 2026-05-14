import * as React from "react";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
        <Button>
          <UserPlus className="mr-2 h-4 w-4" /> Novo usuário
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar novo usuário</DialogTitle>
          <DialogDescription>
            Uma senha temporária será gerada. Você precisará entregá-la ao usuário — no primeiro
            acesso ele será obrigado a definir uma nova senha.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Cargo (sugestão)</Label>
            <CargoSelect value={form.cargo} onChange={(v) => setForm({ ...form, cargo: v })} />
            <p className="text-[11px] text-muted-foreground">
              O cargo é definido no perfil do colaborador vinculado.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Grupo de acesso</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as Role })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="analista">Analista</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Vincular colaborador</Label>
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
                <SelectTrigger>
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
          <DialogFooter>
            <Button type="submit" disabled={saving}>
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
