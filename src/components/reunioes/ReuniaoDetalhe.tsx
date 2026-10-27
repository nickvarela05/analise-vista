import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Calendar as CalIcon,
  FileText,
  Pencil,
  Trash2,
  ExternalLink,
  Clock,
  Download,
  Sparkles,
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, getErrorMessage } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { AssigneeBadges } from "@/components/AssigneeCombobox";
import { TranscricaoFormatada } from "@/components/reunioes/TranscricaoFormatada";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { AssigneeOption } from "@/components/AssigneeCombobox";
import {
  statusBadgeClass,
  transcricaoQuery,
  type ReuniaoLista,
} from "@/components/reunioes/reunioes-lib";

/** Painel lateral com os detalhes de uma reunião. */
export function ReuniaoDetalhe({
  reuniao,
  colabs,
  onFechar,
  onEditar,
  onExcluir,
}: {
  reuniao: ReuniaoLista | null;
  colabs: AssigneeOption[];
  onFechar: () => void;
  onEditar: (r: ReuniaoLista) => void;
  onExcluir: (r: ReuniaoLista) => void;
}) {
  const qc = useQueryClient();
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = React.useState(false);

  const handleGerarRelatorio = async (reuniao: ReuniaoLista) => {
    if (!reuniao?.id) return;
    setGeneratingReport(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gerar-relatorio-reuniao`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ reuniao_id: reuniao.id }),
      });
      if (!res.ok) {
        let msg = `Erro ${res.status}`;
        try {
          const j = await res.json();
          msg = j.error || msg;
        } catch {
          // resposta sem JSON: fica a mensagem com o código HTTP
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="?([^";]+)"?/);
      const filename = match?.[1] || `Relatorio_${reuniao.titulo || "reuniao"}.docx`;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
      toast.success("Relatório gerado!", { description: filename });
    } catch (e: unknown) {
      toast.error("Falha ao gerar relatório", { description: getErrorMessage(e) });
    } finally {
      setGeneratingReport(false);
    }
  };

  const { data: transcricaoDetalhe, isLoading: carregandoTranscricao } = useQuery({
    ...transcricaoQuery(reuniao?.id ?? ""),
    enabled: !!reuniao?.temTranscricao,
  });

  // Audio signed URL para detalhe (Sheet)
  React.useEffect(() => {
    let active = true;
    setAudioUrl(null);
    if (reuniao?.audio_path) {
      supabase.storage
        .from("reuniao-audios")
        .createSignedUrl(reuniao.audio_path, 3600)
        .then(({ data }) => {
          if (active) setAudioUrl(data?.signedUrl ?? null);
        });
    }
    return () => {
      active = false;
    };
  }, [reuniao]);

  const [regenerating, setRegenerating] = React.useState(false);
  const handleRegerar = async (reuniaoId: string) => {
    setRegenerating(true);
    const { error } = await supabase.functions.invoke("analisar-transcricao", {
      body: { reuniao_id: reuniaoId },
    });
    setRegenerating(false);
    if (error) toast.error("Falha ao regerar análise", { description: error.message });
    else
      toast.info("✨ Regerando análise com IA...", {
        description: "A reunião será atualizada em instantes.",
      });
  };

  const [resuming, setResuming] = React.useState(false);
  /** Retoma a transcrição da última parte concluída. */
  const handleRetomarTranscricao = async (reuniao: ReuniaoLista) => {
    if (!reuniao?.audio_path) {
      toast.error("Reunião sem áudio para transcrever");
      return;
    }
    setResuming(true);
    const { error } = await supabase.functions.invoke("transcrever-reuniao", {
      body: { reuniao_id: reuniao.id, audio_path: reuniao.audio_path, retomar: true },
    });
    setResuming(false);
    if (error) toast.error("Falha ao retomar transcrição", { description: error.message });
    else
      toast.info("▶️ Retomando transcrição...", {
        description: "Continua da última parte já transcrita.",
      });
    qc.invalidateQueries({ queryKey: ["reunioes"] });
  };

  return (
    <Sheet open={!!reuniao} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {reuniao && (
          <>
            <SheetHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-xl">{reuniao.titulo}</SheetTitle>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={`capitalize ${statusBadgeClass(reuniao.status)}`}
                    >
                      {reuniao.status}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {reuniao.tipo}
                    </Badge>
                    {reuniao.temTranscricao && reuniao.resumo && (
                      <Badge
                        variant="outline"
                        className="gap-1 border-primary/30 bg-primary/5 text-primary"
                      >
                        <Sparkles className="h-3 w-3" /> Analisada por IA
                      </Badge>
                    )}
                    {reuniao.transcricao_status === "processando" && (
                      <Badge variant="outline" className="gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> processando
                      </Badge>
                    )}
                    {reuniao.transcricao_status === "pausado" && (
                      <Badge
                        variant="outline"
                        className="gap-1 border-amber-500/40 text-amber-700 dark:text-amber-300"
                      >
                        ⏸ pausado
                        {reuniao.transcricao_partes_total
                          ? ` ${reuniao.transcricao_partes_feitas}/${reuniao.transcricao_partes_total}`
                          : ""}
                      </Badge>
                    )}
                    {reuniao.transcricao_status === "erro" && (
                      <Badge variant="destructive">⚠️ erro IA</Badge>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  <Button
                    variant="default"
                    size="sm"
                    disabled={generatingReport}
                    onClick={() => handleGerarRelatorio(reuniao)}
                    title="Gera um relatório detalhado em Word usando IA"
                  >
                    {generatingReport ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileText className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Gerar relatório (Word)
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onEditar(reuniao)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onExcluir(reuniao)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir
                  </Button>
                </div>
              </div>
            </SheetHeader>

            <div className="mt-6 space-y-5 text-sm">
              {/* Meta */}
              <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
                <MetaItem
                  icon={CalIcon}
                  label="Data"
                  value={format(new Date(reuniao.data_reuniao), "EEEE, dd 'de' MMMM 'de' yyyy", {
                    locale: ptBR,
                  })}
                />
                <MetaItem
                  icon={Clock}
                  label="Horário"
                  value={`${format(new Date(reuniao.data_reuniao), "HH:mm")}${
                    reuniao.duracao_min ? ` · ${reuniao.duracao_min} min` : ""
                  }`}
                />
                {reuniao.link_calendario && (
                  <div className="sm:col-span-2">
                    <a
                      href={reuniao.link_calendario}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Abrir no calendário
                    </a>
                  </div>
                )}
              </div>

              {/* Responsáveis */}
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">
                  Responsáveis
                </p>
                <AssigneeBadges
                  selectedIds={reuniao.responsaveis_ids}
                  equipeToda={reuniao.equipe_toda}
                  options={colabs}
                  max={20}
                />
              </div>

              {/* Participantes */}
              {reuniao.participantes && reuniao.participantes.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">
                    Participantes ({reuniao.participantes.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {reuniao.participantes.map((p: string, i: number) => (
                      <Badge key={i} variant="outline">
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Áudio */}
              {reuniao.audio_path && (
                <div>
                  <p className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground">
                    <span>Áudio</span>
                    {audioUrl && (
                      <a
                        href={audioUrl}
                        download
                        className="inline-flex items-center gap-1 text-[10px] normal-case text-primary hover:underline"
                      >
                        <Download className="h-3 w-3" /> Baixar
                      </a>
                    )}
                  </p>
                  {audioUrl ? (
                    <audio controls src={audioUrl} className="w-full" />
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Carregando áudio...
                    </div>
                  )}
                </div>
              )}

              {reuniao.pauta && <Section title="Pauta" content={reuniao.pauta} />}
              {reuniao.resumo && <Section title="Resumo" content={reuniao.resumo} />}
              {reuniao.proximos_passos && (
                <Section title="Próximos passos" content={reuniao.proximos_passos} />
              )}

              {reuniao.decisoes && reuniao.decisoes.length > 0 && (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                    <CheckCheck className="h-3.5 w-3.5" /> Decisões tomadas
                  </p>
                  <ul className="space-y-1.5 rounded-md border bg-muted/30 p-3">
                    {reuniao.decisoes.map((d: string, i: number) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="mt-0.5 text-success">✓</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {reuniao.participantes_detectados && reuniao.participantes_detectados.length > 0 && (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" /> Participantes detectados pela IA
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {reuniao.participantes_detectados.map((p: string, i: number) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="border-primary/30 bg-primary/5 text-primary"
                      >
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {reuniao.transcricao_erro && (
                <div
                  className={cn(
                    "rounded-md border p-3 text-sm",
                    reuniao.transcricao_status === "erro"
                      ? "border-destructive/30 bg-destructive/5 text-destructive"
                      : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
                  )}
                >
                  <p className="font-semibold">
                    {reuniao.transcricao_status === "erro"
                      ? "⚠️ Erro no processamento IA"
                      : reuniao.transcricao_status === "pausado"
                        ? "⏸ Transcrição pausada"
                        : "🎧 Transcrição em andamento"}
                  </p>
                  <p className="mt-1 text-xs">{reuniao.transcricao_erro}</p>
                  {(reuniao.transcricao_status === "erro" ||
                    reuniao.transcricao_status === "pausado") &&
                    reuniao.audio_path && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        disabled={resuming}
                        onClick={() => handleRetomarTranscricao(reuniao)}
                      >
                        {resuming ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Retomar transcrição
                      </Button>
                    )}
                </div>
              )}

              {reuniao.temTranscricao && (
                <Accordion type="single" collapsible>
                  <AccordionItem value="transcricao" className="rounded-md border px-3">
                    <AccordionTrigger className="text-sm">
                      <span className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" /> Ver transcrição completa
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      {carregandoTranscricao ? (
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando transcrição…
                        </p>
                      ) : (
                        <TranscricaoFormatada transcricao={transcricaoDetalhe ?? ""} />
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}

              {reuniao.temTranscricao && (
                <div className="flex justify-end pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRegerar(reuniao.id)}
                    disabled={regenerating || reuniao.transcricao_status === "processando"}
                  >
                    {regenerating || reuniao.transcricao_status === "processando" ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Regerar análise com IA
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MetaItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}

function Section({ title, content, mono }: { title: string; content: string; mono?: boolean }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      <div
        className={`whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm leading-relaxed ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {content}
      </div>
    </div>
  );
}
