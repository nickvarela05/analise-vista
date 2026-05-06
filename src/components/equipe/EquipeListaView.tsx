import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ColaboradorStatusBadge } from "./ColaboradorStatusBadge";
import { computeStatus } from "./lib/status";
import type { Colaborador } from "./lib/types";
import { DIAS, EVENTO_LABEL } from "./lib/types";

interface Props {
  colabs: Colaborador[];
  onSelect: (c: Colaborador) => void;
}

export function EquipeListaView({ colabs, onSelect }: Props) {
  const [q, setQ] = React.useState("");
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const dia = now.getDay();

  const filtered = colabs.filter((c) =>
    c.nome.toLowerCase().includes(q.toLowerCase()) ||
    (c.cargo ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  const grouped = React.useMemo(() => {
    const map = new Map<string, Colaborador[]>();
    for (const c of filtered) {
      const key = c.cargo?.trim() || "Sem cargo";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "Sem cargo") return 1;
      if (b === "Sem cargo") return -1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome ou cargo..."
          className="h-8 pl-8 text-sm"
        />
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[260px]">Colaborador</TableHead>
              <TableHead>Status agora</TableHead>
              <TableHead>Hoje ({DIAS[dia]})</TableHead>
              <TableHead>Almoça em</TableHead>
              <TableHead>Próximo evento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => {
              const status = computeStatus(c, now);
              const h = c.colaborador_horario?.find((x) => x.dia_semana === dia);
              const expediente = h?.expediente_inicio
                ? `${h.expediente_inicio.slice(0, 5)}–${h.expediente_fim?.slice(0, 5) ?? "—"}`
                : "—";
              const proxEvento = c.colaborador_evento
                ?.filter((e) => e.data >= today)
                .sort((a, b) => a.data.localeCompare(b.data))[0];

              return (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => onSelect(c)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        {c.foto_url && <AvatarImage src={c.foto_url} />}
                        <AvatarFallback className="bg-primary/10 text-xs text-primary">
                          {c.nome
                            .split(" ")
                            .slice(0, 2)
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{c.nome}</div>
                        {c.cargo && (
                          <div className="truncate text-xs text-muted-foreground">
                            {c.cargo}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <ColaboradorStatusBadge status={status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {expediente}
                    {h?.almoco_inicio && (
                      <span className="ml-1">
                        · Almoço {h.almoco_inicio.slice(0, 5)}–
                        {h.almoco_fim?.slice(0, 5)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {h?.local_almoco ?? "—"}
                  </TableCell>
                  <TableCell>
                    {proxEvento ? (
                      <Badge variant="outline" className="text-[10px]">
                        {EVENTO_LABEL[proxEvento.tipo]} ·{" "}
                        {proxEvento.data.split("-").reverse().join("/")}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                  Nenhum colaborador.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
