import { Users, Briefcase, Coffee, Plane, AlertTriangle } from "lucide-react";
import { KpiTile } from "@/components/KpiTile";
import { computeStatus, ymdOf } from "./lib/status";
import type { Colaborador } from "./lib/types";

export function EquipeKpis({ colabs }: { colabs: Colaborador[] }) {
  const now = new Date();
  const today = ymdOf(now);
  const startWeek = new Date(now);
  startWeek.setDate(now.getDate() - now.getDay());
  const endWeek = new Date(startWeek);
  endWeek.setDate(startWeek.getDate() + 6);
  const startISO = ymdOf(startWeek);
  const endISO = ymdOf(endWeek);

  let trabalhando = 0;
  let almoco = 0;
  let ferias = 0;
  let eventosSemana = 0;

  for (const c of colabs) {
    const s = computeStatus(c, now);
    if (s.key === "trabalhando") trabalhando++;
    else if (s.key === "almoco") almoco++;
    else if (s.key === "ferias") ferias++;

    for (const e of c.colaborador_evento ?? []) {
      if (e.data >= startISO && e.data <= endISO) eventosSemana++;
    }
  }

  void today;

  return (
    <div className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-5">
      <KpiTile icon={Users} label="Ativos" value={colabs.length} tone="primary" />
      <KpiTile icon={Briefcase} label="Trabalhando agora" value={trabalhando} tone="success" />
      <KpiTile icon={Coffee} label="Em almoço" value={almoco} tone="warning" />
      <KpiTile icon={Plane} label="Em férias hoje" value={ferias} tone="info" />
      <KpiTile
        icon={AlertTriangle}
        label="Eventos esta semana"
        value={eventosSemana}
        tone="destructive"
      />
    </div>
  );
}
