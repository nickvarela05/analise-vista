import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, RefreshCw, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export function ConfiguracoesEmails() {
  const { role, user } = useAuth();
  const [logs, setLogs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [stats, setStats] = React.useState({ sent7d: 0, pending: 0, failed: 0 });
  const [testando, setTestando] = React.useState(false);
  const [reprocessando, setReprocessando] = React.useState(false);

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
        <CardContent className="py-6 text-sm text-muted-foreground">
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
      // dispara processamento
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
      // marca falhados como pending novamente
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Envio de e-mails (N8N)</CardTitle>
        <CardDescription>
          Histórico de envios e teste de integração com o webhook N8N.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <StatBox icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} label="Enviados (7d)" value={stats.sent7d} />
          <StatBox icon={<Clock className="h-4 w-4 text-amber-500" />} label="Na fila" value={stats.pending} />
          <StatBox icon={<AlertCircle className="h-4 w-4 text-destructive" />} label="Falhas" value={stats.failed} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={testarEnvio} disabled={testando}>
            {testando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Testar envio para mim
          </Button>
          <Button size="sm" variant="outline" onClick={reprocessar} disabled={reprocessando || stats.failed === 0}>
            {reprocessando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Reprocessar falhados
          </Button>
          <Button size="sm" variant="ghost" onClick={carregar}>
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
          </Button>
        </div>

        <div className="overflow-x-auto rounded border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Quando</th>
                <th className="px-3 py-2 text-left font-medium">Para</th>
                <th className="px-3 py-2 text-left font-medium">Assunto</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Erro</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Carregando…</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Sem registros ainda.</td></tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2">{l.recipient_email}</td>
                    <td className="px-3 py-2 max-w-xs truncate">{l.subject}</td>
                    <td className="px-3 py-2"><StatusBadge status={l.status} /></td>
                    <td className="px-3 py-2 max-w-xs truncate text-destructive">{l.last_error ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: any; label: string }> = {
    sent: { variant: "default", label: "Enviado" },
    pending: { variant: "secondary", label: "Na fila" },
    failed: { variant: "destructive", label: "Falhou" },
  };
  const cfg = map[status] ?? { variant: "outline", label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
