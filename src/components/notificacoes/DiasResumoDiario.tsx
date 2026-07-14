import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CalendarDays, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";

const DIAS = [
  { v: 0, label: "Dom" },
  { v: 1, label: "Seg" },
  { v: 2, label: "Ter" },
  { v: 3, label: "Qua" },
  { v: 4, label: "Qui" },
  { v: 5, label: "Sex" },
  { v: 6, label: "Sáb" },
] as const;

export function DiasResumoDiario() {
  const [dias, setDias] = React.useState<number[]>([1, 2, 3, 4, 5]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("email_digest_config")
        .select("dias_semana")
        .eq("id", true)
        .maybeSingle();
      if (data?.dias_semana) setDias(data.dias_semana as number[]);
      setLoading(false);
    })();
  }, []);

  const toggle = (d: number) =>
    setDias((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  async function salvar() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("email_digest_config")
        .update({ dias_semana: dias, updated_at: new Date().toISOString() })
        .eq("id", true);
      if (error) throw error;
      toast.success("Dias do resumo diário atualizados");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Falha ao salvar"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="relative bg-gradient-to-br from-violet-500/10 via-background to-background p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <div className="rounded-2xl bg-violet-500/15 p-2.5 text-violet-600 ring-1 ring-violet-500/25 dark:text-violet-300">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Agenda
            </p>
            <h3 className="text-base font-semibold">Dias do resumo diário</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Selecione em quais dias da semana o resumo automático é disparado (10h de Brasília).
            </p>
          </div>
        </div>
      </div>

      <CardContent className="space-y-4 p-5">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {DIAS.map((d) => {
                const on = dias.includes(d.v);
                return (
                  <button
                    key={d.v}
                    type="button"
                    onClick={() => toggle(d.v)}
                    className={`min-w-[54px] rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                      on
                        ? "border-violet-500/40 bg-violet-500/15 text-violet-700 shadow-sm dark:text-violet-300"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/60"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {dias.length === 0
                  ? "Nenhum dia selecionado — o resumo automático ficará desativado."
                  : `${dias.length} dia${dias.length > 1 ? "s" : ""} ativo${dias.length > 1 ? "s" : ""}.`}
              </p>
              <Button size="sm" onClick={salvar} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
