import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, RotateCcw, Sparkles, Wand2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

const CHAVE = "analise_reuniao";
const DEFAULT_PROMPT =
  "Você é um analista de reuniões. Receberá a transcrição de uma reunião em português. Extraia informações estruturadas, objetivas e profissionais. Não invente nada.";

export function ConfiguracoesIA() {
  const { role } = useAuth();
  const isGestor = role === "gestor";
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [id, setId] = React.useState<string | null>(null);
  const [promptSistema, setPromptSistema] = React.useState("");
  const [instrucoesExtras, setInstrucoesExtras] = React.useState("");
  const [ativo, setAtivo] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("ia_prompt_config")
        .select("*")
        .eq("chave", CHAVE)
        .maybeSingle();
      if (error) toast.error("Erro ao carregar", { description: error.message });
      if (data) {
        setId(data.id);
        setPromptSistema(data.prompt_sistema ?? "");
        setInstrucoesExtras(data.instrucoes_extras ?? "");
        setAtivo(data.ativo ?? true);
      } else {
        setPromptSistema(DEFAULT_PROMPT);
      }
      setLoading(false);
    })();
  }, []);

  const salvar = async () => {
    if (!promptSistema.trim()) {
      toast.error("O prompt principal não pode ficar vazio");
      return;
    }
    setSaving(true);
    const payload = {
      chave: CHAVE,
      prompt_sistema: promptSistema.trim(),
      instrucoes_extras: instrucoesExtras.trim() || null,
      ativo,
    };
    const { error } = id
      ? await supabase.from("ia_prompt_config").update(payload).eq("id", id)
      : await supabase.from("ia_prompt_config").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }
    toast.success("Configuração salva", {
      description: "As próximas análises de áudio usarão este prompt.",
    });
  };

  const restaurar = () => {
    setPromptSistema(DEFAULT_PROMPT);
    setInstrucoesExtras("");
    toast.info("Prompt padrão carregado — clique em Salvar para aplicar.");
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
        </CardContent>
      </Card>
    );
  }

  const charCount = promptSistema.length;

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-violet-500/10 via-background to-background p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 p-2.5 text-violet-600 ring-1 ring-violet-500/25 dark:text-violet-300">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              IA · Reuniões
            </p>
            <h3 className="text-base font-semibold">Análise de áudio das reuniões</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Personalize as instruções que a IA usa para gerar resumo, pauta, decisões e próximos
              passos a partir do áudio.
              {!isGestor && " Apenas gestores podem editar."}
            </p>
          </div>
          <Badge
            variant="outline"
            className={
              ativo
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-muted-foreground/30 text-muted-foreground"
            }
          >
            {ativo ? "Ativo" : "Inativo"}
          </Badge>
        </div>
      </div>

      <CardContent className="space-y-5 p-5">
        {/* Toggle ativo */}
        <div className="flex items-center justify-between rounded-xl border bg-muted/20 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-violet-500/10 p-2 text-violet-600 ring-1 ring-violet-500/20 dark:text-violet-300">
              <Wand2 className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-sm font-medium">Prompt ativo</p>
              <p className="text-xs text-muted-foreground">
                Quando desligado, a IA usa o prompt padrão do sistema.
              </p>
            </div>
          </div>
          <Switch checked={ativo} onCheckedChange={setAtivo} disabled={!isGestor} />
        </div>

        {/* Prompt principal */}
        <div className="space-y-2 rounded-xl border bg-card/60 p-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="prompt-sistema" className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              Prompt principal
            </Label>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {charCount} caracteres
            </span>
          </div>
          <Textarea
            id="prompt-sistema"
            rows={6}
            value={promptSistema}
            onChange={(e) => setPromptSistema(e.target.value)}
            disabled={!isGestor}
            placeholder="Ex.: Você é um analista de reuniões..."
            className="resize-y focus-visible:ring-violet-500/40"
          />
          <p className="text-xs text-muted-foreground">
            Define o papel e o estilo geral da IA.
          </p>
        </div>

        {/* Instruções extras */}
        <div className="space-y-2 rounded-xl border bg-card/60 p-4">
          <Label htmlFor="instrucoes-extras" className="flex items-center gap-2 text-sm font-medium">
            <BookOpen className="h-3.5 w-3.5 text-fuchsia-500" />
            Instruções extras
            <Badge variant="outline" className="ml-1 text-[10px] font-normal">
              Opcional
            </Badge>
          </Label>
          <Textarea
            id="instrucoes-extras"
            rows={5}
            value={instrucoesExtras}
            onChange={(e) => setInstrucoesExtras(e.target.value)}
            disabled={!isGestor}
            placeholder="Ex.: Somos uma agência de marketing. Use tom formal. Glossário: SLA = prazo de resposta..."
            className="resize-y focus-visible:ring-fuchsia-500/40"
          />
          <p className="text-xs text-muted-foreground">
            Contexto da empresa, glossário, foco em determinados temas, tom de voz, etc.
          </p>
        </div>

        {isGestor && (
          <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap items-center justify-between gap-2 border-t bg-card/80 px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/60">
            <Button variant="outline" onClick={restaurar} disabled={saving} className="gap-2">
              <RotateCcw className="h-4 w-4" /> Restaurar padrão
            </Button>
            <Button
              onClick={salvar}
              disabled={saving}
              className="gap-2 bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white hover:from-violet-700 hover:to-fuchsia-700"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar configuração
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
