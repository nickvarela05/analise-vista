import * as React from "react";
import { Bell, AlertTriangle, AlertCircle, Info, CheckCheck, MessageSquare, ListTodo, Briefcase, Phone } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const tipoIcon: Record<string, { Icon: typeof Bell; color: string }> = {
  tarefa_atribuida: { Icon: ListTodo, color: "text-sky-600" },
  tarefa_prazo: { Icon: AlertCircle, color: "text-amber-600" },
  tarefa_comentario: { Icon: MessageSquare, color: "text-violet-600" },
  tarefa_status: { Icon: ListTodo, color: "text-emerald-600" },
  demanda_atribuida: { Icon: Briefcase, color: "text-sky-600" },
  demanda_urgente: { Icon: AlertTriangle, color: "text-destructive" },
  chamado_sla: { Icon: Phone, color: "text-amber-600" },
  aviso_critico: { Icon: AlertTriangle, color: "text-destructive" },
  sistema: { Icon: Info, color: "text-muted-foreground" },
};

interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string | null;
  link: string | null;
  lida_em: string | null;
  created_at: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);

  const { data: notificacoes = [] } = useQuery<Notificacao[]>({
    queryKey: ["notificacoes", user?.id],
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notificacao")
        .select("id, tipo, titulo, mensagem, link, lida_em, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as Notificacao[];
    },
  });

  // Realtime: escuta INSERTs para o usuário
  React.useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notificacao-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificacao",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as Notificacao;
          qc.invalidateQueries({ queryKey: ["notificacoes", user.id] });
          toast(n.titulo, {
            description: n.mensagem ?? undefined,
            action: n.link
              ? { label: "Abrir", onClick: () => navigate({ to: n.link! }) }
              : undefined,
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, qc, navigate]);

  const naoLidas = React.useMemo(
    () => notificacoes.filter((n) => !n.lida_em),
    [notificacoes],
  );
  const count = naoLidas.length;

  const marcarComoLida = async (id: string) => {
    await supabase
      .from("notificacao")
      .update({ lida_em: new Date().toISOString() })
      .eq("id", id);
    qc.invalidateQueries({ queryKey: ["notificacoes", user?.id] });
  };

  const marcarTodasLidas = async () => {
    if (!user || naoLidas.length === 0) return;
    await supabase
      .from("notificacao")
      .update({ lida_em: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("lida_em", null);
    qc.invalidateQueries({ queryKey: ["notificacoes", user.id] });
  };

  const handleClick = (n: Notificacao) => {
    setOpen(false);
    if (!n.lida_em) void marcarComoLida(n.id);
    if (n.link) navigate({ to: n.link });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <span className="text-sm font-semibold">Notificações</span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {count} não lida{count === 1 ? "" : "s"}
            </span>
            {count > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px]"
                onClick={marcarTodasLidas}
              >
                <CheckCheck className="mr-1 h-3 w-3" /> Marcar todas
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-96">
          {notificacoes.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              Nenhuma notificação ainda 🎉
            </div>
          ) : (
            <ul className="divide-y">
              {notificacoes.slice(0, 15).map((n) => {
                const cfg = tipoIcon[n.tipo] ?? tipoIcon.sistema;
                const Icon = cfg.Icon;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleClick(n)}
                      className={cn(
                        "flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-muted/50",
                        !n.lida_em && "bg-primary/5",
                      )}
                    >
                      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", cfg.color)} />
                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate text-xs", !n.lida_em ? "font-semibold" : "font-medium")}>
                          {n.titulo}
                        </p>
                        {n.mensagem && (
                          <p className="line-clamp-2 text-[11px] text-muted-foreground">
                            {n.mensagem}
                          </p>
                        )}
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(n.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                      {!n.lida_em && (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t p-2">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate({ to: "/configuracoes" });
            }}
            className="block w-full rounded-md py-1.5 text-center text-xs font-medium text-primary hover:bg-muted"
          >
            Preferências de notificação
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
