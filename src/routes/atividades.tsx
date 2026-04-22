import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  startOfWeek,
  endOfWeek,
  addDays,
  format,
  isSameDay,
  startOfMonth,
  endOfMonth,
  addWeeks,
  subWeeks,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarRange } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PanelCard } from "@/components/StatCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/atividades")({
  component: AtividadesRoute,
});

function AtividadesRoute() {
  return (
    <AppLayout>
      <Atividades />
    </AppLayout>
  );
}

type Periodo = "semana" | "mes";

type Atividade = {
  id: string;
  tipo: "tarefa" | "demanda" | "reuniao";
  titulo: string;
  data: Date;
  prioridade?: string;
  responsavel?: string;
};

const tipoColor: Record<string, string> = {
  tarefa: "bg-info/15 text-info border-info/30",
  demanda: "bg-warning/20 text-warning-foreground border-warning/40",
  reuniao: "bg-primary/15 text-primary border-primary/30",
};

function Atividades() {
  const [periodo, setPeriodo] = React.useState<Periodo>("semana");
  const [cursor, setCursor] = React.useState(new Date());
  const [tipoFiltro, setTipoFiltro] = React.useState<string>("todos");

  const inicio = periodo === "semana" ? startOfWeek(cursor, { weekStartsOn: 1 }) : startOfMonth(cursor);
  const fim = periodo === "semana" ? endOfWeek(cursor, { weekStartsOn: 1 }) : endOfMonth(cursor);

  const { data: tarefas = [] } = useQuery({
    queryKey: ["atv-tarefas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("todo").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: demandas = [] } = useQuery({
    queryKey: ["atv-demandas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("demanda").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: reunioes = [] } = useQuery({
    queryKey: ["atv-reunioes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reuniao").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const todas: Atividade[] = React.useMemo(() => {
    const arr: Atividade[] = [];
    tarefas.forEach((t) => {
      if (t.data_prevista) arr.push({ id: `t-${t.id}`, tipo: "tarefa", titulo: t.titulo, data: new Date(t.data_prevista), prioridade: t.prioridade });
    });
    demandas.forEach((d) => {
      if (d.prazo) arr.push({ id: `d-${d.id}`, tipo: "demanda", titulo: d.titulo, data: new Date(d.prazo), prioridade: d.prioridade });
    });
    reunioes.forEach((r) => {
      arr.push({ id: `r-${r.id}`, tipo: "reuniao", titulo: r.titulo, data: new Date(r.data_reuniao) });
    });
    return arr;
  }, [tarefas, demandas, reunioes]);

  const noPeriodo = todas.filter((a) => a.data >= inicio && a.data <= fim && (tipoFiltro === "todos" || a.tipo === tipoFiltro));

  const navPrev = () => setCursor(periodo === "semana" ? subWeeks(cursor, 1) : new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const navNext = () => setCursor(periodo === "semana" ? addWeeks(cursor, 1) : new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  const hoje = () => setCursor(new Date());

  const dias = periodo === "semana"
    ? Array.from({ length: 7 }, (_, i) => addDays(inicio, i))
    : Array.from({ length: Math.ceil((fim.getTime() - inicio.getTime()) / 86400000) + 1 }, (_, i) => addDays(inicio, i));

  return (
    <div>
      <PageHeader
        title="Atividades semanais"
        description="Agenda consolidada — tarefas, demandas e reuniões com prazo no período."
        actions={
          <div className="flex items-center gap-2">
            <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="tarefa">Tarefas</SelectItem>
                <SelectItem value="demanda">Demandas</SelectItem>
                <SelectItem value="reuniao">Reuniões</SelectItem>
              </SelectContent>
            </Select>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semana">Semana</SelectItem>
                <SelectItem value="mes">Mês</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={navPrev}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" onClick={hoje}>Hoje</Button>
          <Button variant="outline" size="icon" onClick={navNext}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium">
          <CalendarRange className="h-4 w-4 text-muted-foreground" />
          {format(inicio, "dd 'de' MMMM", { locale: ptBR })} – {format(fim, "dd 'de' MMMM yyyy", { locale: ptBR })}
        </div>
      </div>

      {periodo === "semana" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
          {dias.map((dia) => {
            const doDia = noPeriodo.filter((a) => isSameDay(a.data, dia));
            const isHoje = isSameDay(dia, new Date());
            return (
              <PanelCard
                key={dia.toISOString()}
                title={format(dia, "EEE dd/MM", { locale: ptBR })}
                className={isHoje ? "ring-2 ring-primary/40" : ""}
              >
                <div className="min-h-[180px] space-y-2">
                  {doDia.length === 0 ? (
                    <p className="text-xs text-muted-foreground">—</p>
                  ) : (
                    doDia.map((a) => (
                      <div key={a.id} className={`rounded-md border p-2 text-xs ${tipoColor[a.tipo]}`}>
                        <Badge variant="outline" className="mb-1 text-[9px] uppercase">{a.tipo}</Badge>
                        <p className="font-medium leading-tight">{a.titulo}</p>
                        {a.tipo === "reuniao" && (
                          <p className="mt-0.5 text-[10px] opacity-80">{format(a.data, "HH:mm")}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </PanelCard>
            );
          })}
        </div>
      ) : (
        <PanelCard title={format(cursor, "MMMM yyyy", { locale: ptBR })}>
          <div className="grid grid-cols-7 gap-2">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
              <div key={d} className="px-2 py-1 text-center text-[10px] font-semibold uppercase text-muted-foreground">
                {d}
              </div>
            ))}
            {dias.map((dia) => {
              const doDia = noPeriodo.filter((a) => isSameDay(a.data, dia));
              const isHoje = isSameDay(dia, new Date());
              return (
                <div
                  key={dia.toISOString()}
                  className={`min-h-[90px] rounded-md border p-1.5 text-xs ${isHoje ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <div className="mb-1 text-[10px] font-semibold">{format(dia, "dd")}</div>
                  <div className="space-y-1">
                    {doDia.slice(0, 3).map((a) => (
                      <div key={a.id} className={`truncate rounded px-1 py-0.5 text-[10px] ${tipoColor[a.tipo]}`}>
                        {a.titulo}
                      </div>
                    ))}
                    {doDia.length > 3 && (
                      <p className="text-[10px] text-muted-foreground">+{doDia.length - 3}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </PanelCard>
      )}

      <div className="mt-6 flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-info" /> Tarefa</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-warning" /> Demanda</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Reunião</span>
      </div>
    </div>
  );
}
