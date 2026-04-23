import * as React from "react";
import { Bell, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
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

const tipoIcon = {
  critico: { Icon: AlertTriangle, color: "text-destructive" },
  alerta: { Icon: AlertCircle, color: "text-amber-600" },
  informativo: { Icon: Info, color: "text-sky-600" },
} as const;

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = React.useState(false);

  const { data: avisos = [] } = useQuery({
    queryKey: ["bell-avisos"],
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aviso_gestor")
        .select("id, titulo, tipo, created_at, expira_em, colaboradores_ids, colaborador_id")
        .eq("ativo", true)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: leituras = [] } = useQuery({
    queryKey: ["bell-leituras", user?.id],
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aviso_leitura")
        .select("aviso_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const lidos = React.useMemo(
    () => new Set(leituras.map((l) => l.aviso_id)),
    [leituras],
  );

  const naoLidos = React.useMemo(() => {
    const now = Date.now();
    return avisos.filter((a) => {
      if (lidos.has(a.id)) return false;
      if (a.expira_em && new Date(a.expira_em).getTime() < now) return false;
      return true;
    });
  }, [avisos, lidos]);

  const count = naoLidos.length;

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
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <span className="text-sm font-semibold">Notificações</span>
          <span className="text-[11px] text-muted-foreground">
            {count} não lida{count === 1 ? "" : "s"}
          </span>
        </div>
        <ScrollArea className="max-h-80">
          {naoLidos.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              Você está em dia! 🎉
            </div>
          ) : (
            <ul className="divide-y">
              {naoLidos.slice(0, 8).map((a) => {
                const cfg = tipoIcon[a.tipo as keyof typeof tipoIcon];
                const Icon = cfg.Icon;
                return (
                  <li key={a.id}>
                    <Link
                      to="/avisos"
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-muted/50"
                    >
                      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", cfg.color)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{a.titulo}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(a.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t p-2">
          <Link
            to="/avisos"
            onClick={() => setOpen(false)}
            className="block w-full rounded-md py-1.5 text-center text-xs font-medium text-primary hover:bg-muted"
          >
            Ver todos os avisos
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
