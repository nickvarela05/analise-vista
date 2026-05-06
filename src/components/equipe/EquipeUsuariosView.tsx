import * as React from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Trash2, UserPlus, KeyRound, Copy, Check, AlertTriangle, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminFetch } from "@/lib/admin-fetch";
import { useAuth } from "@/lib/auth-context";
import { CargoSelect } from "./CargoSelect";
import type { Colaborador } from "./lib/types";

type Role = "gestor" | "analista";

interface UsuarioRow {
  user_id: string;
  email: string | null;
  nome: string | null;
  avatar_url: string | null;
  cargo: string | null;
  colaborador_id: string | null;
  role: Role | null;
  must_change_password: boolean;
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
}

interface Props {
  colabs: Colaborador[];
}

interface TempPasswordInfo {
  email: string;
  password: string;
  context: "create" | "reset";
}

export function EquipeUsuariosView({ colabs }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["usuarios-admin"],
    queryFn: async () => {
      const r = await adminFetch<{ usuarios: UsuarioRow[] }>("/api/admin/usuarios");
      return r.usuarios;
    },
  });

  const reload = () => qc.invalidateQueries({ queryKey: ["usuarios-admin"] });

  const colabName = React.useMemo(() => {
    const m = new Map<string, string>();
    colabs.forEach((c) => m.set(c.id, c.nome));
    return m;
  }, [colabs]);

  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [tempPasswordInfo, setTempPasswordInfo] = React.useState<TempPasswordInfo | null>(null);

  const resetarSenha = async (u: UsuarioRow) => {
    if (!u.email) return;
    if (!confirm(`Gerar nova senha temporária para ${u.email}? A senha atual deixará de funcionar.`)) return;
    setBusyId(u.user_id);
    try {
      const r = await adminFetch<{ ok: true; temp_password: string }>(
        "/api/admin/usuarios?action=reset-password",
        {
          method: "POST",
          body: JSON.stringify({ user_id: u.user_id }),
        },
      );
      setTempPasswordInfo({ email: u.email, password: r.temp_password, context: "reset" });
      reload();
    } catch (e) {
      toast.error("Erro", { description: (e as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  const alterarRole = async (u: UsuarioRow, role: Role) => {
    if (u.role === role) return;
    setBusyId(u.user_id);
    try {
      await adminFetch("/api/admin/usuarios?action=role", {
        method: "POST",
        body: JSON.stringify({ user_id: u.user_id, role }),
      });
      toast.success("Role atualizada");
      reload();
    } catch (e) {
      toast.error("Erro", { description: (e as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  const vincular = async (u: UsuarioRow, colaborador_id: string | null) => {
    setBusyId(u.user_id);
    try {
      await adminFetch("/api/admin/usuarios?action=link", {
        method: "POST",
        body: JSON.stringify({ user_id: u.user_id, colaborador_id }),
      });
      toast.success(colaborador_id ? "Vinculado" : "Desvinculado");
      reload();
    } catch (e) {
      toast.error("Erro", { description: (e as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  const remover = async (u: UsuarioRow) => {
    if (!confirm(`Remover usuário ${u.email}? Esta ação não pode ser desfeita.`)) return;
    setBusyId(u.user_id);
    try {
      await adminFetch("/api/admin/usuarios?action=delete", {
        method: "POST",
        body: JSON.stringify({ user_id: u.user_id }),
      });
      toast.success("Usuário removido");
      reload();
    } catch (e) {
      toast.error("Erro", { description: (e as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Falha ao carregar usuários: {(error as Error).message}
      </div>
    );
  }

  const usuarios = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {usuarios.length} usuário{usuarios.length === 1 ? "" : "s"} cadastrado{usuarios.length === 1 ? "" : "s"}.
        </p>
        <div className="flex items-center gap-2">
          <ConvidarUsuarioDialog />
          <CriarUsuarioDialog
            colabs={colabs}
            onCreated={(info) => {
              setTempPasswordInfo(info);
              reload();
            }}
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Colaborador vinculado</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.map((u) => {
              const isMe = u.user_id === user?.id;
              const busy = busyId === u.user_id;
              return (
                <TableRow key={u.user_id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                        <AvatarFallback className="bg-primary/10 text-xs text-primary">
                          {(u.nome ?? u.email ?? "?").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="leading-tight">
                        <div className="text-sm font-medium">
                          {u.nome ?? "—"}
                          {isMe && (
                            <Badge variant="outline" className="ml-2 text-[10px]">
                              você
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={u.role ?? undefined}
                      onValueChange={(v) => alterarRole(u, v as Role)}
                      disabled={busy}
                    >
                      <SelectTrigger className="h-8 w-[130px]">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gestor">Gestor</SelectItem>
                        <SelectItem value="analista">Analista</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={u.colaborador_id ?? "__none__"}
                      onValueChange={(v) => vincular(u, v === "__none__" ? null : v)}
                      disabled={busy}
                    >
                      <SelectTrigger className="h-8 w-[220px]">
                        <SelectValue placeholder="Sem vínculo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Sem vínculo —</SelectItem>
                        {colabs.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {u.colaborador_id && !colabName.has(u.colaborador_id) && (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Vinculado a colaborador inativo
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5 text-xs">
                      {u.must_change_password ? (
                        <Badge
                          variant="outline"
                          className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-400"
                        >
                          <AlertTriangle className="mr-1 h-3 w-3" /> Senha temporária
                        </Badge>
                      ) : u.last_sign_in_at ? (
                        <Badge variant="outline" className="text-[10px]">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Nunca acessou</Badge>
                      )}
                      {u.last_sign_in_at && (
                        <div className="text-[10px] text-muted-foreground">
                          Último acesso: {format(new Date(u.last_sign_in_at), "dd/MM/yyyy HH:mm")}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => resetarSenha(u)}
                        disabled={busy}
                        title="Gerar nova senha temporária"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => remover(u)}
                        disabled={busy || isMe}
                        title={isMe ? "Você não pode remover seu próprio usuário" : "Remover usuário"}
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {usuarios.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  Nenhum usuário cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <TempPasswordDialog
        info={tempPasswordInfo}
        onClose={() => setTempPasswordInfo(null)}
      />
    </div>
  );
}

function CriarUsuarioDialog({
  colabs,
  onCreated,
}: {
  colabs: Colaborador[];
  onCreated: (info: TempPasswordInfo) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<{
    email: string;
    nome: string;
    cargo: string;
    role: Role;
    colaborador_id: string;
  }>({ email: "", nome: "", cargo: "", role: "analista", colaborador_id: "__none__" });

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
      setForm({ email: "", nome: "", cargo: "", role: "analista", colaborador_id: "__none__" });
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
            Uma senha temporária será gerada. Você precisará entregá-la ao usuário —
            no primeiro acesso ele será obrigado a definir uma nova senha.
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
            <CargoSelect
              value={form.cargo}
              onChange={(v) => setForm({ ...form, cargo: v })}
            />
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
                      email: c.email ?? form.email,
                      cargo: c.cargo ?? form.cargo,
                    });
                    toast.success("Dados do colaborador preenchidos", {
                      description: "Nome, e-mail e cargo foram migrados automaticamente.",
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

function TempPasswordDialog({
  info,
  onClose,
}: {
  info: TempPasswordInfo | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => {
    if (info) setCopied(false);
  }, [info]);

  if (!info) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(info.password);
      setCopied(true);
      toast.success("Senha copiada");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <Dialog open={!!info} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {info.context === "create" ? "Usuário criado" : "Senha redefinida"}
          </DialogTitle>
          <DialogDescription>
            Esta senha é temporária e <strong>aparece apenas uma vez</strong>.
            Copie e entregue ao usuário em um canal seguro. No primeiro acesso ele
            será obrigado a definir uma nova senha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">E-mail</Label>
            <Input value={info.email} readOnly />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Senha temporária</Label>
            <div className="flex items-center gap-2">
              <Input
                value={info.password}
                readOnly
                className="font-mono tracking-wider"
              />
              <Button type="button" variant="outline" size="icon" onClick={copy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
            Anote ou copie agora — esta senha não poderá ser recuperada depois.
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConvidarUsuarioDialog() {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<Role>("analista");
  const [result, setResult] = React.useState<{ email: string; token: string; link: string } | null>(null);
  const [copied, setCopied] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    try {
      const r = await adminFetch<{ ok: true; token: string; email: string; role: Role }>(
        "/api/admin/usuarios?action=invite",
        {
          method: "POST",
          body: JSON.stringify({ email: email.trim(), role }),
        },
      );
      const link = `${window.location.origin}/login?invite=${r.token}&email=${encodeURIComponent(r.email)}`;
      setResult({ email: r.email, token: r.token, link });
      setEmail("");
    } catch (err) {
      toast.error("Erro ao gerar convite", { description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copiado");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const reset = () => {
    setResult(null);
    setEmail("");
    setRole("analista");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Mail className="mr-2 h-4 w-4" /> Gerar convite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{result ? "Convite gerado" : "Gerar convite"}</DialogTitle>
          <DialogDescription>
            {result
              ? "Envie o link abaixo ao convidado. O convite expira em 7 dias e só pode ser usado uma vez."
              : "Gere um token de convite para que a pessoa possa se cadastrar pela tela de login."}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">E-mail convidado</Label>
              <Input value={result.email} readOnly />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Token</Label>
              <div className="flex items-center gap-2">
                <Input value={result.token} readOnly className="font-mono text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={() => copy(result.token)}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Link de cadastro</Label>
              <div className="flex items-center gap-2">
                <Input value={result.link} readOnly className="text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={() => copy(result.link)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
              Compartilhe por canal seguro. Qualquer pessoa com o link e o e-mail correto poderá criar a conta.
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={reset}>Gerar outro</Button>
              <Button onClick={() => setOpen(false)}>Fechar</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="pessoa@empresa.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Grupo de acesso</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="analista">Analista</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Gerar convite
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
