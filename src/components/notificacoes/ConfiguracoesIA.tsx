import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, RotateCcw, Sparkles } from "lucide-react";
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
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Análise de áudio das reuniões
        </CardTitle>
        <CardDescription>
          Personalize as instruções que a IA usa para gerar resumo, pauta, decisões e próximos passos
          a partir do áudio enviado em uma reunião.
          {!isGestor && " Apenas gestores podem editar."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Prompt ativo</p>
            <p className="text-xs text-muted-foreground">
              Quando desligado, a IA usa o prompt padrão do sistema.
            </p>
          </div>
          <Switch checked={ativo} onCheckedChange={setAtivo} disabled={!isGestor} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="prompt-sistema">Prompt principal</Label>
          <Textarea
            id="prompt-sistema"
            rows={6}
            value={promptSistema}
            onChange={(e) => setPromptSistema(e.target.value)}
            disabled={!isGestor}
            placeholder="Ex.: Você é um analista de reuniões..."
          />
          <p className="text-xs text-muted-foreground">
            Define o papel e o estilo geral da IA.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="instrucoes-extras">Instruções extras (opcional)</Label>
          <Textarea
            id="instrucoes-extras"
            rows={5}
            value={instrucoesExtras}
            onChange={(e) => setInstrucoesExtras(e.target.value)}
            disabled={!isGestor}
            placeholder="Ex.: Somos uma agência de marketing. Use tom formal. Glossário: SLA = prazo de resposta..."
          />
          <p className="text-xs text-muted-foreground">
            Contexto da empresa, glossário, foco em determinados temas, tom de voz, etc.
          </p>
        </div>

        {isGestor && (
          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={salvar} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar
            </Button>
            <Button variant="outline" onClick={restaurar} disabled={saving}>
              <RotateCcw className="mr-2 h-4 w-4" /> Restaurar padrão
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
