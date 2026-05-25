import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, Loader2, AlertCircle, Code2, Calendar, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/insights")({
  component: () => (
    <AppLayout>
      <InsightsPage />
    </AppLayout>
  ),
});

const EXEMPLOS = [
  "minhas demandas urgentes",
  "tarefas atrasadas esta semana",
  "chamados com prazo estourado",
  "reuniões dos últimos 30 dias",
];

function InsightsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Insights & IA"
        description="Busca em linguagem natural e resumos executivos gerados por IA."
      />
      <Tabs defaultValue="busca" className="space-y-4">
        <TabsList>
          <TabsTrigger value="busca">
            <Sparkles className="mr-2 h-4 w-4" /> Busca natural
          </TabsTrigger>
          <TabsTrigger value="resumo">
            <Calendar className="mr-2 h-4 w-4" /> Resumo semanal
          </TabsTrigger>
        </TabsList>
        <TabsContent value="busca"><BuscaIA /></TabsContent>
        <TabsContent value="resumo"><ResumoSemanal /></TabsContent>
      </Tabs>
    </div>
  );
}

function BuscaIA() {
  const [pergunta, setPergunta] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [resultado, setResultado] = React.useState<{ sql_gerado: string; resultados: any[] } | null>(null);
  const [showSql, setShowSql] = React.useState(false);

  async function executar(q?: string) {
    const query = (q ?? pergunta).trim();
    if (query.length < 3) return;
    setPergunta(query);
    setLoading(true);
    setErro(null);
    setResultado(null);
    try {
      const { data, error } = await supabase.functions.invoke("busca-natural", {
        body: { pergunta: query },
      });
      if (error) throw new Error(error.message);
      if (data?.error) {
        setErro(data.error);
        if (data.sql_gerado) setResultado({ sql_gerado: data.sql_gerado, resultados: [] });
      } else {
        setResultado(data);
      }
    } catch (e: any) {
      setErro(e?.message ?? "Falha na busca");
    } finally {
      setLoading(false);
    }
  }

  const colunas = resultado?.resultados?.[0] ? Object.keys(resultado.resultados[0]) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pergunte em português</CardTitle>
        <CardDescription>
          A IA gera uma consulta SQL segura (só leitura, com seus filtros de acesso) e mostra os resultados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={(e) => { e.preventDefault(); executar(); }}
          className="flex gap-2"
        >
          <Input
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            placeholder="Ex.: minhas tarefas atrasadas"
            disabled={loading}
            maxLength={500}
          />
          <Button type="submit" disabled={loading || pergunta.trim().length < 3}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">Buscar</span>
          </Button>
        </form>

        <div className="flex flex-wrap gap-2">
          {EXEMPLOS.map((ex) => (
            <Badge
              key={ex}
              variant="outline"
              className="cursor-pointer hover:bg-accent"
              onClick={() => executar(ex)}
            >
              {ex}
            </Badge>
          ))}
        </div>

        {erro && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{erro}</span>
          </div>
        )}

        {resultado && (
          <div className="space-y-3">
            <div>
              <Button variant="ghost" size="sm" onClick={() => setShowSql(!showSql)} className="h-7 px-2 text-xs">
                <Code2 className="mr-1 h-3 w-3" /> {showSql ? "Ocultar" : "Ver"} SQL gerado
              </Button>
              {showSql && (
                <pre className="mt-2 overflow-x-auto rounded bg-muted p-3 text-xs">
                  <code>{resultado.sql_gerado}</code>
                </pre>
              )}
            </div>

            {resultado.resultados.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum resultado.</p>
            ) : (
              <div className="overflow-x-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {colunas.map((c) => (
                        <th key={c} className="px-3 py-2 text-left font-medium">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.resultados.slice(0, 50).map((row, i) => (
                      <tr key={i} className="border-t">
                        {colunas.map((c) => (
                          <td key={c} className="px-3 py-2 text-muted-foreground">
                            {formatCell(row[c])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="border-t bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  {resultado.resultados.length} resultado{resultado.resultados.length !== 1 ? "s" : ""}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatCell(v: any): string {
  if (v == null) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "string" && v.length > 80) return v.slice(0, 80) + "…";
  return String(v);
}

function ResumoSemanal() {
  const { role } = useAuth();
  const [resumos, setResumos] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [gerando, setGerando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    setErro(null);
    const { data, error } = await supabase
      .from("resumo_semanal")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) {
      setErro(error.message);
      setResumos([]);
      setLoading(false);
      return;
    }
    setResumos(data ?? []);
    setLoading(false);
  }

  React.useEffect(() => { carregar(); }, []);

  async function gerarAgora() {
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-resumo-semanal");
      if (error) throw error;
      if ((data?.gerados ?? 0) > 0) {
        toast.success("Resumo gerado", { description: `${data.gerados} resumo${data.gerados === 1 ? "" : "s"} atualizado${data.gerados === 1 ? "" : "s"}.` });
      } else {
        toast.info("Nenhum resumo novo", { description: "Não foram encontradas atividades na semana anterior para resumir." });
      }
      await carregar();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar");
    } finally {
      setGerando(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base">Resumos executivos</CardTitle>
          <CardDescription>Gerados automaticamente toda segunda-feira às 7h.</CardDescription>
        </div>
        {role === "gestor" && (
          <Button size="sm" variant="outline" onClick={gerarAgora} disabled={gerando}>
            {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Gerar agora
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : erro ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{erro}</span>
          </div>
        ) : resumos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum resumo ainda. {role === "gestor" && "Clique em \"Gerar agora\" para criar o primeiro."}</p>
        ) : (
          <div className="space-y-4">
            {resumos.map((r) => (
              <div key={r.id} className="rounded-lg border p-4">
                <div className="mb-2 flex items-center justify-between">
                  <Badge variant="outline">
                    {new Date(r.semana_inicio).toLocaleDateString("pt-BR")} – {new Date(r.semana_fim).toLocaleDateString("pt-BR")}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                {r.metricas && (
                  <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {Object.entries(r.metricas as Record<string, any>).slice(0, 8).map(([k, v]) => (
                      <div key={k} className="rounded bg-muted/50 p-2">
                        <div className="text-[10px] uppercase text-muted-foreground">{k}</div>
                        <div className="text-sm font-semibold">{String(v)}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm text-foreground/90">
                  {r.conteudo_md}
                </div>
                {r.insights && r.insights.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {r.insights.map((it: string, i: number) => <li key={i}>{it}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
