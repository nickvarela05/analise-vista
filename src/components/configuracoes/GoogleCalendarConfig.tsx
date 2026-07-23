import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calendar, RefreshCw, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getGoogleCalendarConfig,
  updateGoogleCalendarConfig,
  runGoogleCalendarSyncNow,
  listGoogleCalendars,
} from "@/lib/google-calendar.functions";

function formatDateTime(iso: string | null) {
  if (!iso) return "Nunca";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    });
  } catch {
    return iso;
  }
}

export function GoogleCalendarConfig() {
  const qc = useQueryClient();
  const getConfig = useServerFn(getGoogleCalendarConfig);
  const updateConfig = useServerFn(updateGoogleCalendarConfig);
  const runSync = useServerFn(runGoogleCalendarSyncNow);
  const listCals = useServerFn(listGoogleCalendars);

  const cfgQuery = useQuery({ queryKey: ["gcal", "config"], queryFn: () => getConfig() });
  const calsQuery = useQuery({
    queryKey: ["gcal", "calendars"],
    queryFn: () => listCals(),
    retry: false,
  });

  const [calendarId, setCalendarId] = React.useState("");
  const [dias, setDias] = React.useState(30);
  const [ativo, setAtivo] = React.useState(false);

  React.useEffect(() => {
    if (cfgQuery.data) {
      setCalendarId(cfgQuery.data.google_calendar_id ?? "");
      setDias(cfgQuery.data.dias_horizonte ?? 30);
      setAtivo(cfgQuery.data.sync_ativo ?? false);
    }
  }, [cfgQuery.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      updateConfig({
        data: {
          google_calendar_id: calendarId.trim() || null,
          dias_horizonte: dias,
          sync_ativo: ativo,
        },
      }),
    onSuccess: () => {
      toast.success("Configuração salva.");
      qc.invalidateQueries({ queryKey: ["gcal", "config"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const syncMut = useMutation({
    mutationFn: () => runSync(),
    onSuccess: (r) => {
      if (!r.ok) {
        toast.error(`Sincronização com erros: ${r.erros[0] ?? ""}`);
      } else {
        toast.success(
          `Sincronizado: ${r.criados} criados, ${r.atualizados} atualizados, ${r.removidos} removidos.`,
        );
      }
      qc.invalidateQueries({ queryKey: ["gcal", "config"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha na sincronização."),
  });

  const cfg = cfgQuery.data;
  const isLoading = cfgQuery.isLoading;

  return (
    <Card className="border-sky-500/15">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-sky-500/15 p-2.5 text-sky-600 ring-1 ring-sky-500/25 dark:text-sky-400">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base">Google Agenda</CardTitle>
            <CardDescription>
              Replica reuniões, tarefas, demandas e chamados no calendário compartilhado da equipe.
            </CardDescription>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => syncMut.mutate()}
          disabled={syncMut.isPending || !cfg?.google_calendar_id}
          className="gap-2"
        >
          {syncMut.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Sincronizar agora
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="gcal-id">Calendário de destino</Label>
                {calsQuery.data && calsQuery.data.length > 0 ? (
                  <Select value={calendarId} onValueChange={setCalendarId}>
                    <SelectTrigger id="gcal-id">
                      <SelectValue placeholder="Selecione um calendário" />
                    </SelectTrigger>
                    <SelectContent>
                      {calsQuery.data.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.summary} {c.primary && "(principal)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="gcal-id"
                    placeholder="primary ou id-do-calendario@group.calendar.google.com"
                    value={calendarId}
                    onChange={(e) => setCalendarId(e.target.value)}
                  />
                )}
                {calsQuery.isError && (
                  <p className="text-xs text-muted-foreground">
                    Não foi possível listar seus calendários — informe o ID manualmente.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="gcal-dias">Horizonte de sincronização (dias)</Label>
                <Input
                  id="gcal-dias"
                  type="number"
                  min={1}
                  max={180}
                  value={dias}
                  onChange={(e) => setDias(Math.max(1, Math.min(180, Number(e.target.value) || 30)))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-3">
              <div>
                <p className="text-sm font-medium">Sincronização automática (a cada 15 min)</p>
                <p className="text-xs text-muted-foreground">
                  Cria, atualiza e remove eventos automaticamente conforme as atividades mudam.
                </p>
              </div>
              <Switch checked={ativo} onCheckedChange={setAtivo} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                {cfg?.ultimo_erro ? (
                  <>
                    <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                    <span className="text-destructive">Último erro: {cfg.ultimo_erro}</span>
                  </>
                ) : cfg?.ultima_sync_em ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    Última sincronização: {formatDateTime(cfg.ultima_sync_em)}
                  </>
                ) : (
                  <span>Nenhuma sincronização executada.</span>
                )}
              </div>
              <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                {saveMut.isPending ? "Salvando…" : "Salvar configuração"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
