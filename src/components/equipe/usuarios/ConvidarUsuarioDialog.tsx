import * as React from "react";
import { AlertTriangle, Check, Copy, Loader2, Mail } from "lucide-react";
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
import { adminFetch } from "@/lib/admin-fetch";
import type { Role } from "./types";

export function ConvidarUsuarioDialog() {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<Role>("analista");
  const [result, setResult] = React.useState<{ email: string; token: string; link: string } | null>(
    null,
  );
  const [copied, setCopied] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    try {
      const r = await adminFetch<{ ok: true; token: string; email: string; role: Role }>(
        "/api/admin/usuarios?action=invite",
        { method: "POST", body: JSON.stringify({ email: email.trim(), role }) },
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
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => copy(result.token)}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Link de cadastro</Label>
              <div className="flex items-center gap-2">
                <Input value={result.link} readOnly className="text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => copy(result.link)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
              Compartilhe por canal seguro. Qualquer pessoa com o link e o e-mail correto poderá
              criar a conta.
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={reset}>
                Gerar outro
              </Button>
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
