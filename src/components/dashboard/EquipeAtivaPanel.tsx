import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { Plane, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Panel } from "@/components/KpiTile";

interface FeriasItem {
  id: string;
  data_inicio: string;
  data_fim: string;
  colaborador?: { nome?: string | null; foto_url?: string | null } | null;
}

interface Props {
  totalColaboradores: number;
  feriasAtivas: number;
  proximasFerias: FeriasItem[];
}

export function EquipeAtivaPanel({ totalColaboradores, feriasAtivas, proximasFerias }: Props) {
  return (
    <Panel
      title="Equipe ativa"
      actions={
        <Link to="/equipe" className="text-xs font-medium text-primary hover:underline">
          Gerenciar →
        </Link>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-lg border bg-muted/30 p-3">
            <Users className="mx-auto mb-1 h-4 w-4 text-primary" />
            <p className="text-xl font-semibold tabular-nums">{totalColaboradores}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Colaboradores</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <Plane className="mx-auto mb-1 h-4 w-4 text-warning" />
            <p className="text-xl font-semibold tabular-nums">{feriasAtivas}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">De férias</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Próximas férias
          </p>
          {proximasFerias.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma programada.</p>
          ) : (
            <ul className="space-y-2">
              {proximasFerias.map((f) => (
                <li key={f.id} className="flex items-center gap-2 text-xs">
                  <Avatar className="h-6 w-6">
                    {f.colaborador?.foto_url && <AvatarImage src={f.colaborador.foto_url} />}
                    <AvatarFallback className="bg-primary/10 text-[9px] text-primary">
                      {(f.colaborador?.nome ?? "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">
                    {f.colaborador?.nome?.split(" ")[0] ?? "—"}
                  </span>
                  <span className="text-muted-foreground">
                    {format(new Date(f.data_inicio), "dd/MM")} – {format(new Date(f.data_fim), "dd/MM")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  );
}
