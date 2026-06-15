import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Search, MailX, UserCheck, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Perfil = {
  user_id: string;
  nome: string | null;
  email: string | null;
  recebe_resumo_diario: boolean;
};

export function DestinatariosResumoDiario() {
  const qc = useQueryClient();
  const [busca, setBusca] = React.useState("");

  const { data: perfis = [], isLoading } = useQuery({
    queryKey: ["destinatarios-resumo-diario"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, nome, email, recebe_resumo_diario")
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Perfil[];
    },
  });

  const toggleOne = useMutation({
    mutationFn: async (vars: { userId: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ recebe_resumo_diario: vars.ativo })
        .eq("user_id", vars.userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["destinatarios-resumo-diario"] }),
    onError: (e: Error) => toast.error("Falha ao atualizar", { description: e.message }),
  });

  const bulkSet = useMutation({
    mutationFn: async (ativo: boolean) => {
      const ids = perfis.filter((p) => !!p.email).map((p) => p.user_id);
      if (ids.length === 0) return;
      const { error } = await supabase
        .from("profiles")
        .update({ recebe_resumo_diario: ativo })
        .in("user_id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ativo) => {
      toast.success(ativo ? "Todos ativados" : "Todos desativados");
      qc.invalidateQueries({ queryKey: ["destinatarios-resumo-diario"] });
    },
    onError: (e: Error) => toast.error("Falha", { description: e.message }),
  });

  const lista = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return perfis;
    return perfis.filter(
      (p) =>
        (p.nome ?? "").toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q),
    );
  }, [perfis, busca]);

  const total = perfis.length;
  const recebem = perfis.filter((p) => p.recebe_resumo_diario && p.email).length;
  const naoRecebem = perfis.filter((p) => !p.recebe_resumo_diario && p.email).length;
  const semEmail = perfis.filter((p) => !p.email).length;

  return (
    <Card className="overflow-hidden">
      <div className="relative bg-gradient-to-br from-violet-500/10 via-background to-background p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <div className="rounded-2xl bg-violet-500/15 p-2.5 text-violet-600 ring-1 ring-violet-500/25 dark:text-violet-300">
            <Mail className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Resumo diário
            </p>
            <h3 className="text-base font-semibold">Destinatários do resumo diário</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Defina quem recebe o e-mail diário (10h) com demandas, reuniões, tarefas em alerta e novos relatórios.
            </p>
          </div>
        </div>
      </div>

      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou e-mail…"
              className="h-9 pl-8 text-sm"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => bulkSet.mutate(true)}
            disabled={bulkSet.isPending}
            className="gap-1.5"
          >
            <UserCheck className="h-3.5 w-3.5" /> Ativar todos
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => bulkSet.mutate(false)}
            disabled={bulkSet.isPending}
            className="gap-1.5"
          >
            <UserX className="h-3.5 w-3.5" /> Desativar todos
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">{total} usuários</Badge>
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
            {recebem} recebem
          </Badge>
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
            {naoRecebem} não recebem
          </Badge>
          {semEmail > 0 && (
            <Badge variant="outline" className="border-muted text-muted-foreground">
              {semEmail} sem e-mail
            </Badge>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border">
          <div className="max-h-[420px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : lista.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Nenhum usuário encontrado.
              </div>
            ) : (
              <ul className="divide-y">
                {lista.map((p) => {
                  const semEmail = !p.email;
                  return (
                    <li
                      key={p.user_id}
                      className={`flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/20 ${semEmail ? "opacity-60" : ""}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{p.nome ?? "Sem nome"}</div>
                        <div className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                          {semEmail ? (
                            <>
                              <MailX className="h-3 w-3" /> Sem e-mail cadastrado
                            </>
                          ) : (
                            p.email
                          )}
                        </div>
                      </div>
                      <Switch
                        checked={!!p.recebe_resumo_diario && !semEmail}
                        disabled={semEmail || toggleOne.isPending}
                        onCheckedChange={(v) =>
                          toggleOne.mutate({ userId: p.user_id, ativo: v })
                        }
                        aria-label={p.recebe_resumo_diario ? "Desativar" : "Ativar"}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
