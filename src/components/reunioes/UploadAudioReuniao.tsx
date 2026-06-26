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
import { startUploadJob, useUploadJob, useUploadStore } from "@/lib/reuniao-upload-manager";

type Status = "pendente" | "processando" | "concluido" | "erro";

interface Props {
  reuniaoId: string | null; // null em modo "criação" (sem id ainda)
  userId: string;
  titulo?: string;
  audioPath: string | null;
  status: Status;
  errorMessage: string | null;
  onUploaded: (info: {
    audio_path: string;
    audio_size: number;
    audio_mime: string;
  }) => Promise<void> | void;
  onProcessingDone?: () => void;
  /**
   * Em modo criação: salva rascunho da reunião e devolve o id criado para
   * que o upload em segundo plano possa atrelar o áudio a uma reunião real.
   */
  onAutoSaveDraft?: () => Promise<string | null>;
}

const ACCEPT =
  "audio/*,audio/mpeg,audio/mp3,audio/m4a,audio/x-m4a,audio/wav,audio/webm,audio/ogg,audio/mp4,video/mp4,.mp3,.m4a,.wav,.webm,.ogg,.mp4,.aac,.flac";
const MAX_BYTES = 25 * 1024 * 1024;
const AUDIO_EXTENSIONS = /\.(mp3|m4a|wav|webm|ogg|mp4|aac|flac|oga|opus)$/i;

export function UploadAudioReuniao({
  reuniaoId,
  userId,
  titulo,
  audioPath,
  status,
  errorMessage,
  onUploaded,
  onProcessingDone,
  onAutoSaveDraft,
}: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [triggering, setTriggering] = React.useState(false);
  const [preparing, setPreparing] = React.useState(false);

  const job = useUploadJob(reuniaoId);
  const cancelJob = useUploadStore((s) => s.cancel);

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
      toast.error("Arquivo acima de 25 MB", {
        description: "O limite é de 25 MB. Reduza, comprima ou divida o arquivo antes de enviar.",
      });
      return;
    }

    // Garante uma reunião persistida antes de enfileirar o job
    let rid = reuniaoId;
    if (!rid) {
      if (!onAutoSaveDraft) {
        toast.error("Salve a reunião primeiro");
        return;
      }
      setPreparing(true);
      try {
        rid = await onAutoSaveDraft();
      } catch (e: any) {
        setPreparing(false);
        toast.error("Erro ao salvar rascunho", { description: e?.message });
        return;
      }
      setPreparing(false);
      if (!rid) return;
    }

    startUploadJob({
      reuniaoId: rid,
      userId,
      titulo: titulo?.trim() || "Reunião",
      file: rawFile,
      onUploaded,
    });

    toast.info("🚀 Processamento iniciado em segundo plano", {
      description: "Você pode sair desta página — o upload continuará rodando.",
    });
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

  const jobActive =
    job &&
    (job.phase === "compressing" ||
      job.phase === "uploading" ||
      job.phase === "triggering");
  const isProcessing = status === "processando" || triggering;

  const jobPhaseLabel: Record<string, string> = {
    compressing: "🎛️ Otimizando áudio",
    uploading: "📤 Enviando para o servidor",
    triggering: "✨ Iniciando análise IA",
  };

  return (
    <div className="rounded-lg border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-info/5 p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            Áudio e análise automática
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Anexe a gravação. A otimização e o upload rodam em segundo plano —
            você pode fechar este formulário e navegar pelo sistema enquanto isso.
          </p>
        </div>
      </div>

      {/* Sem áudio e sem job ativo: drop zone */}
      {!audioPath && !jobActive && !preparing && (
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
            MP3, M4A, WAV, WebM, OGG ou MP4 · até 1 GB (otimização automática)
          </p>
          <p className="mt-2 text-[11px] text-primary">
            ⚡ Processamento em segundo plano — você pode sair da página
          </p>
        </div>
      )}

      {preparing && (
        <div className="flex items-center gap-2 rounded-md border bg-background/80 p-3 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Salvando rascunho da reunião…</span>
        </div>
      )}

      {/* Job em andamento (compressão/upload/trigger) */}
      {jobActive && job && (
        <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              {job.phase === "compressing" && <Wand2 className="h-4 w-4 animate-pulse text-primary" />}
              {job.phase === "uploading" && <Upload className="h-4 w-4 animate-pulse text-primary" />}
              {job.phase === "triggering" && <Sparkles className="h-4 w-4 animate-pulse text-primary" />}
              <span>
                {jobPhaseLabel[job.phase]}
                {(job.phase === "compressing" || job.phase === "uploading") &&
                  ` ${job.progress}%`}
              </span>
            </span>
            {(job.phase === "compressing" || job.phase === "uploading") && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => cancelJob(job.reuniaoId)}
              >
                <X className="mr-1 h-3.5 w-3.5" /> Cancelar
              </Button>
            )}
          </div>
          {(job.phase === "compressing" || job.phase === "uploading") && (
            <Progress value={job.progress} />
          )}
          <p className="text-xs text-muted-foreground">
            💡 Você pode fechar este formulário ou navegar para outra página — o processamento continua.
          </p>
        </div>
      )}

      {/* Áudio anexado */}
      {audioPath && !jobActive && (
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
                  disabled={removing}
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
