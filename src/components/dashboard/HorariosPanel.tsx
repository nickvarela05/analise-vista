import { Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Panel } from "@/components/KpiTile";

export interface HorarioItem {
  nome: string;
  foto: string | null;
  expediente: string;
  almoco: string;
  local: string;
}

export function HorariosPanel({ horarios }: { horarios: HorarioItem[] }) {
  return (
    <Panel
      title="Horários (segunda)"
      actions={
        <Link to="/equipe" className="text-xs font-medium text-primary hover:underline">
          Editar →
        </Link>
      }
    >
      {horarios.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Cadastre horários em{" "}
          <Link to="/equipe" className="font-medium text-primary hover:underline">
            Equipe
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y divide-border/50">
          {horarios.map((h, i) => (
            <li key={i} className="flex items-center gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
              <Avatar className="h-8 w-8 shrink-0">
                {h.foto && <AvatarImage src={h.foto} />}
                <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                  {h.nome.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium leading-tight">{h.nome}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-foreground/80">
                    <Clock className="h-3 w-3 text-primary" />
                    {h.expediente}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                    <span aria-hidden>🍽</span>
                    {h.almoco}
                    <span className="text-muted-foreground/80">· {h.local}</span>
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
