import * as React from "react";
import { Loader2, Sparkles, Upload, AlertCircle, RefreshCw, CheckCircle2, FileAudio, Trash2, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { compressAudio, shouldCompress, formatBytes } from "@/lib/audio-compress";

type Status = "pendente" | "processando" | "concluido" | "erro";

interface Props {
  reuniaoId: string | null; // null em modo "criação" (sem id ainda)
  userId: string;
  audioPath: string | null;
  status: Status;
  errorMessage: string | null;
  onUploaded: (info: {
    audio_path: string;
    audio_size: number;
    audio_mime: string;
  }) => Promise<void> | void;
  onProcessingDone?: () => void;
  /** Em modo criação: cria rascunho da reunião e dispara análise antes de salvar definitivo. */
  onRequestEarlyAnalysis?: () => Promise<void> | void;
}

const ACCEPT =
  "audio/*,audio/mpeg,audio/mp3,audio/m4a,audio/x-m4a,audio/wav,audio/webm,audio/ogg,audio/mp4,video/mp4,.mp3,.m4a,.wav,.webm,.ogg,.mp4,.aac,.flac";
const MAX_BYTES = 1024 * 1024 * 1024; // 1 GB de entrada (será comprimido antes do upload)
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // limite do Groq Whisper
const AUDIO_EXTENSIONS = /\.(mp3|m4a|wav|webm|ogg|mp4|aac|flac|oga|opus)$/i;

export function UploadAudioReuniao({
  reuniaoId,
  userId,
  audioPath,
  status,
  errorMessage,
  onUploaded,
  onProcessingDone,
  onRequestEarlyAnalysis,
}: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadPct, setUploadPct] = React.useState(0);
  const [compressing, setCompressing] = React.useState(false);
  const [compressPct, setCompressPct] = React.useState(0);
  const [compressInfo, setCompressInfo] = React.useState<{ original: number; compressed: number } | null>(null);
  const compressAbortRef = React.useRef<AbortController | null>(null);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [triggering, setTriggering] = React.useState(false);

  // Signed URL para player
  React.useEffect(() => {
    let active = true;
    setAudioUrl(null);
    if (audioPath) {
      supabase.storage
        .from("reuniao-audios")
        .createSignedUrl(audioPath, 3600)
        .then(({ data }) => active && setAudioUrl(data?.signedUrl ?? null));
    }
    return () => {
      active = false;
    };
  }, [audioPath]);

  // Notifica quando processamento termina
  const prevStatus = React.useRef(status);
  React.useEffect(() => {
    if (prevStatus.current === "processando" && status === "concluido") {
      onProcessingDone?.();
      toast.success("✨ Análise concluída!", {
        description: "Resumo, pauta, decisões e próximos passos preenchidos automaticamente.",
      });
    }
    prevStatus.current = status;
  }, [status, onProcessingDone]);

  const triggerProcessing = async (rid: string, path: string) => {
    setTriggering(true);
    try {
      const { error } = await supabase.functions.invoke("transcrever-reuniao", {
        body: { reuniao_id: rid, audio_path: path },
      });
      if (error) throw error;
    } catch (e: any) {
      toast.error("Falha ao iniciar análise", { description: e?.message });
    } finally {
      setTriggering(false);
    }
  };

  const cancelCompression = () => {
    compressAbortRef.current?.abort();
  };

  const handleFile = async (rawFile: File) => {
    const isAudioMime = rawFile.type.startsWith("audio/");
    const isMp4Container = rawFile.type === "video/mp4" || /\.(mp4|mov|mkv|avi)$/i.test(rawFile.name);
    const hasAudioExt = AUDIO_EXTENSIONS.test(rawFile.name);
    if (!isAudioMime && !isMp4Container && !hasAudioExt) {
      toast.error("Arquivo não é um áudio válido", {
        description: "Formatos aceitos: MP3, M4A, WAV, WebM, OGG, MP4, AAC, FLAC.",
      });
      return;
    }
    if (rawFile.size > MAX_BYTES) {
      toast.error("Arquivo acima de 1 GB", { description: "Reduza ou divida o arquivo." });
      return;
    }

    let file = rawFile;
    setCompressInfo(null);

    // === Compressão automática (MP4/vídeo ou áudio > 20 MB) ===
    if (shouldCompress(rawFile)) {
      setCompressing(true);
      setCompressPct(0);
      const ctrl = new AbortController();
      compressAbortRef.current = ctrl;
      try {
        const result = await compressAudio(rawFile, {
          signal: ctrl.signal,
          onProgress: (p) => setCompressPct(p),
        });
        file = result.file;
        setCompressInfo({ original: result.originalSize, compressed: result.compressedSize });
        toast.success("🎛️ Áudio otimizado", {
          description: `${formatBytes(result.originalSize)} → ${formatBytes(result.compressedSize)}`,
        });
      } catch (e: any) {
        setCompressing(false);
        compressAbortRef.current = null;
        if (ctrl.signal.aborted) {
          toast.info("Compressão cancelada");
          return;
        }
        if (rawFile.size <= MAX_UPLOAD_BYTES) {
          toast.warning("Não foi possível otimizar o áudio", {
            description: "Enviando o arquivo original.",
          });
          file = rawFile;
        } else {
          toast.error("Falha ao comprimir o áudio", {
            description:
              e?.message ||
              `O arquivo (${formatBytes(rawFile.size)}) excede o limite de ${formatBytes(MAX_UPLOAD_BYTES)} da API de transcrição.`,
          });
          return;
        }
      } finally {
        setCompressing(false);
        compressAbortRef.current = null;
      }
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`Áudio acima de ${formatBytes(MAX_UPLOAD_BYTES)}`, {
        description: "Mesmo após otimização o arquivo é grande demais para a API de transcrição.",
      });
      return;
    }

    setUploading(true);
    setUploadPct(15);

    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${userId}/${Date.now()}-${safeName}`;
    const normalizedType =
      file.type && file.type !== "video/mp4" ? file.type : "audio/mp4";
    const { error } = await supabase.storage.from("reuniao-audios").upload(path, file, {
      upsert: false,
      contentType: normalizedType,
    });
    setUploadPct(100);

    if (error) {
      setUploading(false);
      toast.error("Erro no upload", { description: error.message });
      return;
    }

    await onUploaded({ audio_path: path, audio_size: file.size, audio_mime: normalizedType });
    setUploading(false);

    if (reuniaoId) {
      await triggerProcessing(reuniaoId, path);
      toast.info("🎧 Transcrevendo áudio...", {
        description: "Isso pode levar de 20s a 3min dependendo da duração.",
      });
    } else {
      toast.success("Áudio anexado", {
        description: "A análise por IA começará após você salvar a reunião.",
      });
    }
  };

  const reprocessar = async () => {
    if (!reuniaoId || !audioPath) return;
    await triggerProcessing(reuniaoId, audioPath);
    toast.info("🎧 Reprocessando áudio...");
  };

  const [removing, setRemoving] = React.useState(false);
  const removerAudio = async () => {
    if (!audioPath) return;
    setRemoving(true);
    try {
      await supabase.storage.from("reuniao-audios").remove([audioPath]);
      if (reuniaoId) {
        await supabase
          .from("reuniao")
          .update({
            audio_path: null,
            audio_size: null,
            audio_mime: null,
            transcricao_status: "pendente",
            transcricao_erro: null,
          })
          .eq("id", reuniaoId);
      }
      await onUploaded({ audio_path: "", audio_size: 0, audio_mime: "" });
      toast.success("Áudio removido com sucesso");
    } catch (e: any) {
      toast.error("Erro ao remover áudio", { description: e?.message });
    } finally {
      setRemoving(false);
    }
  };

  const isProcessing = status === "processando" || triggering;

  return (
    <div className="rounded-lg border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-info/5 p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            Áudio e análise automática
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Anexe a gravação. A IA vai transcrever e preencher resumo, pauta, decisões e próximos passos.
          </p>
        </div>
      </div>

      {/* Sem áudio: drop zone */}
      {!audioPath && !uploading && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed py-8 text-center transition-colors ${
            dragOver
              ? "border-primary bg-primary/10"
              : "border-border bg-background/50 hover:border-primary/50 hover:bg-primary/5"
          }`}
        >
          <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Clique ou arraste um arquivo</p>
          <p className="mt-1 text-xs text-muted-foreground">
            MP3, M4A, WAV, WebM ou OGG · até 100 MB
          </p>
        </div>
      )}

      {/* Upload em progresso */}
      {uploading && (
        <div className="space-y-2 rounded-md border bg-background/80 p-3">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>📤 Enviando áudio...</span>
          </div>
          <Progress value={uploadPct} />
        </div>
      )}

      {/* Áudio anexado */}
      {audioPath && !uploading && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-md border bg-background/80 p-2.5">
            <FileAudio className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{audioPath.split("/").pop()}</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={removing || uploading}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  {removing ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Excluir áudio
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir áudio da reunião?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O arquivo de áudio será removido permanentemente do armazenamento. A transcrição e os campos
                    já preenchidos pela IA (resumo, pauta, decisões, próximos passos) permanecem inalterados —
                    você pode editá-los manualmente. Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={removerAudio}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Excluir áudio
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {audioUrl && <audio controls src={audioUrl} className="w-full" />}

          {/* Status processamento */}
          {isProcessing && (
            <div className="flex items-center gap-2 rounded-md border border-info/30 bg-info/5 p-2.5 text-sm text-info">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>🎧 Transcrevendo e analisando com IA... pode levar até 3 minutos.</span>
            </div>
          )}

          {status === "concluido" && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-success/30 bg-success/5 p-2.5 text-sm text-success">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Análise concluída — campos preenchidos abaixo
              </span>
              {reuniaoId && (
                <Button type="button" size="sm" variant="outline" onClick={reprocessar}>
                  <RefreshCw className="mr-1.5 h-3 w-3" /> Regerar
                </Button>
              )}
            </div>
          )}

          {status === "erro" && (
            <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-sm text-destructive">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Falha no processamento</p>
                  <p className="text-xs opacity-80">{errorMessage || "Erro desconhecido"}</p>
                </div>
              </div>
              {reuniaoId && (
                <Button type="button" size="sm" variant="outline" onClick={reprocessar}>
                  <RefreshCw className="mr-1.5 h-3 w-3" /> Tentar novamente
                </Button>
              )}
            </div>
          )}

          {status === "pendente" && reuniaoId && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full"
              onClick={reprocessar}
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Iniciar análise por IA
            </Button>
          )}

          {status === "pendente" && !reuniaoId && (
            <div className="space-y-2">
              {onRequestEarlyAnalysis && (
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  disabled={triggering}
                  onClick={async () => {
                    setTriggering(true);
                    try {
                      await onRequestEarlyAnalysis();
                    } finally {
                      setTriggering(false);
                    }
                  }}
                >
                  {triggering ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Iniciar análise por IA agora
                </Button>
              )}
              <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-2.5 text-xs text-primary">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Você pode iniciar a análise agora (cria um rascunho automaticamente) ou clicar em{" "}
                  <strong>Salvar</strong> para iniciar junto.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
