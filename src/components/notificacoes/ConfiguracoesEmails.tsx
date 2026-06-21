import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Send,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Mail,
  Inbox,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";

export function ConfiguracoesEmails() {
  const { role, user } = useAuth();
  const [logs, setLogs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [stats, setStats] = React.useState({ sent7d: 0, pending: 0, failed: 0 });
  const [testando, setTestando] = React.useState(false);
  const [reprocessando, setReprocessando] = React.useState(false);
  const [disparandoResumo, setDisparandoResumo] = React.useState(false);
  const [limpando, setLimpando] = React.useState(false);

  async function carregar() {
    setLoading(true);
    const { data } = await supabase
      .from("email_send_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setLogs(data ?? []);

    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const all = data ?? [];
    setStats({
      sent7d: all.filter((l) => l.status === "sent" && l.created_at >= since).length,
      pending: all.filter((l) => l.status === "pending").length,
      failed: all.filter((l) => l.status === "failed").length,
    });
    setLoading(false);
  }

  React.useEffect(() => { if (role === "gestor") carregar(); }, [role]);

  if (role !== "gestor") {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          <Mail className="mx-auto mb-2 h-6 w-6 opacity-50" />
          Apenas gestores podem visualizar a configuração de e-mails.
        </CardContent>
      </Card>
    );
  }

  async function testarEnvio() {
    if (!user?.email) { toast.error("Sem e-mail no perfil"); return; }
    setTestando(true);
    try {
      const { error } = await supabase.from("email_send_log").insert({
        user_id: user.id,
        recipient_email: user.email,
        subject: "✅ Teste de envio — Sisteplan",
        body_html: `<div style="font-family:Arial,sans-serif"><h2>Funcionou!</h2><p>Se você está lendo isso, o N8N está corretamente conectado ao sistema.</p><p style="color:#888;font-size:12px">Disparado em ${new Date().toLocaleString("pt-BR")}</p></div>`,
        body_text: "Teste de envio Sisteplan — funcionou.",
        status: "pending",
      });
      if (error) throw error;
      await supabase.functions.invoke("dispatch-email-digest", { body: { mode: "imediato" } });
      toast.success(`E-mail de teste enviado para ${user.email}`);
      setTimeout(carregar, 2000);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha");
    } finally {
      setTestando(false);
    }
  }

  async function reprocessar() {
    setReprocessando(true);
    try {
      const { error } = await supabase
        .from("email_send_log")
        .update({ status: "pending", attempts: 0, last_error: null })
        .eq("status", "failed");
      if (error) throw error;
      await supabase.functions.invoke("dispatch-email-digest", { body: { mode: "imediato" } });
      toast.success("Reprocessamento disparado");
      setTimeout(carregar, 2000);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha");
    } finally {
      setReprocessando(false);
    }
  }

  async function dispararResumoDiario() {
    setDisparandoResumo(true);
    try {
      const { error } = await supabase.functions.invoke("dispatch-email-digest", { body: { mode: "resumo_diario" } });
      if (error) throw error;
      toast.success("Resumo diário enfileirado para todos os usuários elegíveis");
      setTimeout(carregar, 2500);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha");
    } finally {
      setDisparandoResumo(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-sky-500/10 via-background to-background p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <div className="rounded-2xl bg-sky-500/15 p-2.5 text-sky-600 ring-1 ring-sky-500/25 dark:text-sky-300">
            <Mail className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Integração
            </p>
            <h3 className="text-base font-semibold">Envio de e-mails (N8N)</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Histórico de envios e teste de integração com o webhook N8N.
            </p>
          </div>
        </div>
      </div>

      <CardContent className="space-y-5 p-5">
        {/* Stat tiles */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile
            icon={CheckCircle2}
            label="Enviados (7d)"
            value={stats.sent7d}
            tone="emerald"
          />
          <StatTile
            icon={Clock}
            label="Na fila"
            value={stats.pending}
            tone="amber"
          />
          <StatTile
            icon={AlertCircle}
            label="Falhas"
            value={stats.failed}
            tone="destructive"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 rounded-xl border bg-muted/20 p-3">
          <Button size="sm" onClick={testarEnvio} disabled={testando} className="gap-2">
            {testando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Testar envio para mim
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={reprocessar}
            disabled={reprocessando || stats.failed === 0}
            className="gap-2"
          >
            {reprocessando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Reprocessar falhados
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={dispararResumoDiario}
            disabled={disparandoResumo}
            className="gap-2"
          >
            {disparandoResumo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Disparar resumo diário agora
          </Button>
          <Button size="sm" variant="ghost" onClick={carregar} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Atualizar
          </Button>
        </div>



        {/* Log table */}
        <div className="overflow-hidden rounded-xl border">
          <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Inbox className="h-3.5 w-3.5" />
            Últimos 50 envios
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/20">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium text-muted-foreground">Quando</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Para</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Assunto</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Status</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Erro</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      Sem registros ainda.
                    </td>
                  </tr>
                ) : (
                  logs.map((l) => (
                    <tr key={l.id} className="border-t transition-colors hover:bg-muted/20">
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {new Date(l.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-3 py-2 font-medium">{l.recipient_email}</td>
                      <td className="max-w-xs truncate px-3 py-2">{l.subject}</td>
                      <td className="px-3 py-2"><StatusBadge status={l.status} /></td>
                      <td className="max-w-xs truncate px-3 py-2 text-destructive">
                        {l.last_error ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const toneMap: Record<string, { bg: string; text: string; ring: string }> = {
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/25" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", ring: "ring-amber-500/25" },
  destructive: { bg: "bg-destructive/10", text: "text-destructive", ring: "ring-destructive/25" },
};

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: keyof typeof toneMap;
}) {
  const t = toneMap[tone];
  return (
    <div className="rounded-xl border bg-card/60 p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-2">
        <div className={`rounded-lg p-1.5 ring-1 ${t.bg} ${t.text} ${t.ring}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { className: string; label: string }> = {
    sent: {
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      label: "Enviado",
    },
    pending: {
      className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      label: "Na fila",
    },
    failed: {
      className: "border-destructive/40 bg-destructive/10 text-destructive",
      label: "Falhou",
    },
  };
  const cfg = map[status] ?? { className: "", label: status };
  return (
    <Badge variant="outline" className={cfg.className}>
      {cfg.label}
    </Badge>
  );
}
