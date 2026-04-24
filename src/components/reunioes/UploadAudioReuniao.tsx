import * as React from "react";
import { Loader2, Sparkles, Upload, AlertCircle, RefreshCw, CheckCircle2, FileAudio, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

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
}

const ACCEPT =
  "audio/*,audio/mpeg,audio/mp3,audio/m4a,audio/x-m4a,audio/wav,audio/webm,audio/ogg,audio/mp4,video/mp4,.mp3,.m4a,.wav,.webm,.ogg,.mp4,.aac,.flac";
const MAX_BYTES = 100 * 1024 * 1024;
const AUDIO_EXTENSIONS = /\.(mp3|m4a|wav|webm|ogg|mp4|aac|flac|oga|opus)$/i;

export function UploadAudioReuniao({
  reuniaoId,
  userId,
  audioPath,
  status,
  errorMessage,
  onUploaded,
  onProcessingDone,
}: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadPct, setUploadPct] = React.useState(0);
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

  const handleFile = async (file: File) => {
    const isAudioMime = file.type.startsWith("audio/");
    const isMp4Container = file.type === "video/mp4" || /\.mp4$/i.test(file.name);
    const hasAudioExt = AUDIO_EXTENSIONS.test(file.name);
    if (!isAudioMime && !isMp4Container && !hasAudioExt) {
      toast.error("Arquivo não é um áudio válido", {
        description: "Formatos aceitos: MP3, M4A, WAV, WebM, OGG, MP4, AAC, FLAC.",
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Áudio acima de 100MB", { description: "Comprima ou divida o arquivo." });
      return;
    }

    setUploading(true);
    setUploadPct(15);

    const path = `${userId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error } = await supabase.storage.from("reuniao-audios").upload(path, file, {
      upsert: false,
      contentType: file.type,
    });
    setUploadPct(100);

    if (error) {
      setUploading(false);
      toast.error("Erro no upload", { description: error.message });
      return;
    }

    await onUploaded({ audio_path: path, audio_size: file.size, audio_mime: file.type });
    setUploading(false);

    // Se já existe reunião salva, dispara processamento
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

  const removerAudio = async () => {
    if (!audioPath) return;
    if (!confirm("Remover o áudio anexado?")) return;
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
            <Button type="button" variant="ghost" size="sm" onClick={removerAudio}>
              <X className="h-3.5 w-3.5" />
            </Button>
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
