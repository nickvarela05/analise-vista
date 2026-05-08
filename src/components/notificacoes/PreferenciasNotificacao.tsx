import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

type EventoTipo =
  | "tarefa_atribuida"
  | "tarefa_prazo"
  | "tarefa_comentario"
  | "tarefa_status"
  | "demanda_atribuida"
  | "demanda_urgente"
  | "chamado_sla"
  | "aviso_critico";

const EVENTOS: { id: EventoTipo; label: string; desc: string }[] = [
  { id: "tarefa_atribuida", label: "Tarefa atribuída", desc: "Quando alguém te coloca como responsável." },
  { id: "tarefa_comentario", label: "Comentário em tarefa", desc: "Novos comentários em tarefas suas." },
  { id: "tarefa_prazo", label: "Prazo de tarefa", desc: "Aviso 24h antes do prazo." },
  { id: "demanda_atribuida", label: "Demanda atribuída", desc: "Nova demanda sob sua responsabilidade." },
  { id: "demanda_urgente", label: "Demanda urgente", desc: "Demandas marcadas como urgentes." },
  { id: "chamado_sla", label: "SLA de chamado externo", desc: "Quando o SLA está prestes a estourar." },
  { id: "aviso_critico", label: "Avisos críticos", desc: "Avisos de gestor classificados como críticos." },
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Notificações</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[1fr_80px_80px] items-center gap-2 border-b pb-2 text-[11px] font-medium uppercase text-muted-foreground">
          <span>Evento</span>
          <span className="text-center">Sistema</span>
          <span className="text-center">E-mail</span>
        </div>
        <div className="divide-y">
          {EVENTOS.map((e) => (
            <div key={e.id} className="grid grid-cols-[1fr_80px_80px] items-center gap-2 py-3">
              <div>
                <p className="text-sm font-medium">{e.label}</p>
                <p className="text-xs text-muted-foreground">{e.desc}</p>
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
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          O envio por e-mail ainda depende da configuração do domínio de e-mail do sistema.
        </p>
      </CardContent>
    </Card>
  );
}
