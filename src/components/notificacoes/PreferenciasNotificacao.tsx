import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  Bell,
  CheckSquare,
  MessageSquare,
  Clock,
  Briefcase,
  AlertTriangle,
  Timer,
  Megaphone,
  Monitor,
  Mail,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type EventoTipo =
  | "tarefa_atribuida"
  | "tarefa_prazo"
  | "tarefa_comentario"
  | "tarefa_status"
  | "demanda_atribuida"
  | "demanda_urgente"
  | "chamado_sla"
  | "aviso_critico";

const EVENTOS: {
  id: EventoTipo;
  label: string;
  desc: string;
  icon: LucideIcon;
  tone: string;
}[] = [
  { id: "tarefa_atribuida", label: "Tarefa atribuída", desc: "Quando alguém te coloca como responsável.", icon: CheckSquare, tone: "text-primary bg-primary/10 ring-primary/20" },
  { id: "tarefa_comentario", label: "Comentário em tarefa", desc: "Novos comentários em tarefas suas.", icon: MessageSquare, tone: "text-sky-600 bg-sky-500/10 ring-sky-500/20 dark:text-sky-400" },
  { id: "tarefa_prazo", label: "Prazo de tarefa", desc: "Aviso 24h antes do prazo.", icon: Clock, tone: "text-amber-600 bg-amber-500/10 ring-amber-500/20 dark:text-amber-400" },
  { id: "demanda_atribuida", label: "Demanda atribuída", desc: "Nova demanda sob sua responsabilidade.", icon: Briefcase, tone: "text-indigo-600 bg-indigo-500/10 ring-indigo-500/20 dark:text-indigo-400" },
  { id: "demanda_urgente", label: "Demanda urgente", desc: "Demandas marcadas como urgentes.", icon: AlertTriangle, tone: "text-rose-600 bg-rose-500/10 ring-rose-500/20 dark:text-rose-400" },
  { id: "chamado_sla", label: "SLA de chamado externo", desc: "Quando o SLA está prestes a estourar.", icon: Timer, tone: "text-orange-600 bg-orange-500/10 ring-orange-500/20 dark:text-orange-400" },
  { id: "aviso_critico", label: "Avisos críticos", desc: "Avisos de gestor classificados como críticos.", icon: Megaphone, tone: "text-destructive bg-destructive/10 ring-destructive/25" },
];

interface Pref {
  evento: EventoTipo;
  canal: "in_app" | "email";
  ativo: boolean;
}

export function PreferenciasNotificacao() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: prefs = [] } = useQuery<Pref[]>({
    queryKey: ["notif-prefs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notificacao_preferencia")
        .select("evento, canal, ativo")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as Pref[];
    },
  });

  const isAtivo = (evento: EventoTipo, canal: "in_app" | "email") => {
    const p = prefs.find((x) => x.evento === evento && x.canal === canal);
    return p ? p.ativo : true; // default ON
  };

  const toggle = async (evento: EventoTipo, canal: "in_app" | "email", ativo: boolean) => {
    if (!user) return;
    const { error } = await supabase
      .from("notificacao_preferencia")
      .upsert(
        { user_id: user.id, evento, canal, ativo },
        { onConflict: "user_id,evento,canal" },
      );
    if (error) {
      toast.error("Não foi possível salvar a preferência");
      return;
    }
    qc.invalidateQueries({ queryKey: ["notif-prefs", user.id] });
  };

  return (
    <Card className="overflow-hidden">
      {/* Header tonal */}
      <div className="relative bg-gradient-to-br from-indigo-500/10 via-background to-background p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <div className="rounded-2xl bg-indigo-500/15 p-2.5 text-indigo-600 ring-1 ring-indigo-500/25 dark:text-indigo-300">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Preferências
            </p>
            <h3 className="text-base font-semibold">Notificações por evento</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Escolha por qual canal você quer ser avisado em cada situação.
            </p>
          </div>
        </div>
      </div>

      <CardContent className="p-0">
        {/* Cabeçalho */}
        <div className="grid grid-cols-[1fr_92px_92px] items-center gap-3 border-y bg-muted/30 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Evento</span>
          <span className="flex items-center justify-center gap-1.5">
            <Monitor className="h-3 w-3" /> Sistema
          </span>
          <span className="flex items-center justify-center gap-1.5">
            <Mail className="h-3 w-3" /> E-mail
          </span>
        </div>

        <div className="divide-y">
          {EVENTOS.map((e) => {
            const Icon = e.icon;
            return (
              <div
                key={e.id}
                className="group grid grid-cols-[1fr_92px_92px] items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/30"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className={`mt-0.5 rounded-lg p-2 ring-1 ${e.tone}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{e.label}</p>
                    <p className="text-xs text-muted-foreground">{e.desc}</p>
                  </div>
                </div>
                <div className="flex justify-center">
                  <Switch
                    checked={isAtivo(e.id, "in_app")}
                    onCheckedChange={(v) => toggle(e.id, "in_app", v)}
                  />
                </div>
                <div className="flex justify-center">
                  <Switch
                    checked={isAtivo(e.id, "email")}
                    onCheckedChange={(v) => toggle(e.id, "email", v)}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t bg-muted/20 px-5 py-3 text-[11px] text-muted-foreground">
          O envio por e-mail depende da configuração do domínio de e-mail do sistema.
        </div>
      </CardContent>
    </Card>
  );
}
