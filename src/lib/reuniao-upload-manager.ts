// Gerenciador global de uploads de áudio de reunião em segundo plano.
// Persiste fora do ciclo de vida dos componentes — o usuário pode navegar
// entre páginas (SPA) que o trabalho continua. Reconecta a UI ao abrir
// novamente a reunião correspondente.
//
// Limitações: fechar a aba / o navegador interrompe a compressão e upload.
// Após o upload concluir, a transcrição roda no servidor e é resiliente.

import { create } from "zustand";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { compressAudio, shouldCompress, formatBytes } from "@/lib/audio-compress";

export type JobPhase =
  | "compressing"
  | "uploading"
  | "triggering"
  | "done"
  | "error"
  | "canceled";

export interface UploadJob {
  reuniaoId: string;
  titulo: string;
  fileName: string;
  phase: JobPhase;
  progress: number; // 0-100 da fase atual
  originalSize: number;
  compressedSize?: number;
  errorMsg?: string;
  startedAt: number;
  finishedAt?: number;
  abort: AbortController;
}

interface State {
  jobs: Record<string, UploadJob>;
}

interface Actions {
  /** Cria/atualiza job. */
  upsert: (id: string, patch: Partial<UploadJob>) => void;
  remove: (id: string) => void;
  cancel: (id: string) => void;
}

export const useUploadStore = create<State & Actions>((set, get) => ({
  jobs: {},
  upsert: (id, patch) =>
    set((s) => {
      const existing = s.jobs[id];
      // Se o job foi removido (ex.: cancelado), não recria a partir de um patch parcial.
      if (!existing && !(patch.phase === "compressing" && patch.startedAt)) {
        return s;
      }
      return {
        jobs: {
          ...s.jobs,
          [id]: { ...(existing as UploadJob), ...patch } as UploadJob,
        },
      };
    }),
  remove: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.jobs;
      return { jobs: rest };
    }),
  cancel: (id) => {
    const j = get().jobs[id];
    if (!j) return;
    // Dispara abort para interromper laços que checam o signal (encode/upload).
    try { j.abort.abort(); } catch { /* noop */ }
    // Marca como cancelado e remove rapidamente — operações síncronas
    // (decodeAudioData, ffmpeg.exec) não atendem ao signal no meio do
    // trabalho, mas a UI não pode ficar presa esperando.
    set((s) => ({
      jobs: { ...s.jobs, [id]: { ...(s.jobs[id] as UploadJob), phase: "canceled", finishedAt: Date.now() } },
    }));
    setTimeout(() => {
      set((s) => {
        const { [id]: _, ...rest } = s.jobs;
        return { jobs: rest };
      });
    }, 1500);
  },
}));

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export interface StartJobOpts {
  reuniaoId: string;
  userId: string;
  titulo: string;
  file: File;
  /** Callback chamada após upload concluído (para atualizar form). */
  onUploaded?: (info: { audio_path: string; audio_size: number; audio_mime: string }) => void | Promise<void>;
}

/**
 * Inicia o pipeline completo em background: compressão → upload → trigger IA.
 * Retorna imediatamente; acompanhe via useUploadStore.
 */
export async function startUploadJob(opts: StartJobOpts): Promise<void> {
  const { reuniaoId, userId, titulo, file, onUploaded } = opts;
  const store = useUploadStore.getState();
  const abort = new AbortController();

  store.upsert(reuniaoId, {
    reuniaoId,
    titulo,
    fileName: file.name,
    phase: "compressing",
    progress: 0,
    originalSize: file.size,
    startedAt: Date.now(),
    abort,
  });

  // Roda em microtask para não bloquear o caller
  (async () => {
    try {
      let finalFile = file;

      if (shouldCompress(file)) {
        const result = await compressAudio(file, {
          signal: abort.signal,
          onProgress: (p) =>
            useUploadStore.getState().upsert(reuniaoId, { phase: "compressing", progress: p }),
        });
        finalFile = result.file;
        useUploadStore
          .getState()
          .upsert(reuniaoId, { compressedSize: result.compressedSize, progress: 100 });
      }

      if (abort.signal.aborted) throw new Error("CANCELED");

      if (finalFile.size > MAX_UPLOAD_BYTES) {
        throw new Error(
          `Áudio excede ${formatBytes(MAX_UPLOAD_BYTES)} mesmo após otimização.`,
        );
      }

      // === Upload ===
      useUploadStore.getState().upsert(reuniaoId, { phase: "uploading", progress: 10 });
      const safeName = finalFile.name.replace(/[^\w.\-]+/g, "_");
      const path = `${userId}/${Date.now()}-${safeName}`;
      const normalizedType =
        finalFile.type && finalFile.type !== "video/mp4" ? finalFile.type : "audio/mp4";

      const { error: upErr } = await supabase.storage
        .from("reuniao-audios")
        .upload(path, finalFile, { upsert: false, contentType: normalizedType });
      if (upErr) throw new Error(upErr.message);

      useUploadStore.getState().upsert(reuniaoId, { progress: 100 });

      // Atualiza a reunião com o áudio
      await supabase
        .from("reuniao")
        .update({
          audio_path: path,
          audio_size: finalFile.size,
          audio_mime: normalizedType,
          transcricao_status: "processando",
          transcricao_erro: null,
        })
        .eq("id", reuniaoId);

      await onUploaded?.({ audio_path: path, audio_size: finalFile.size, audio_mime: normalizedType });

      // === Trigger IA ===
      useUploadStore.getState().upsert(reuniaoId, { phase: "triggering", progress: 0 });
      const { error: fnErr } = await supabase.functions.invoke("transcrever-reuniao", {
        body: { reuniao_id: reuniaoId, audio_path: path },
      });
      if (fnErr) throw new Error(fnErr.message);

      useUploadStore.getState().upsert(reuniaoId, {
        phase: "done",
        progress: 100,
        finishedAt: Date.now(),
      });

      toast.success(`🎧 "${titulo}" enviada para análise`, {
        description: "A transcrição rodará em segundo plano no servidor.",
      });

      // Auto-remove após 8s
      setTimeout(() => useUploadStore.getState().remove(reuniaoId), 8000);
    } catch (e: any) {
      const canceled = abort.signal.aborted || e?.message === "CANCELED";
      if (!canceled) {
        console.error("[upload-manager] Job falhou:", { reuniaoId, titulo, error: e });
      }
      useUploadStore.getState().upsert(reuniaoId, {
        phase: canceled ? "canceled" : "error",
        errorMsg: canceled ? undefined : e?.message || "Erro desconhecido",
        finishedAt: Date.now(),
      });
      if (!canceled) {
        toast.error(`Falha no upload de "${titulo}"`, {
          description: e?.message || "Veja o console (F12) para detalhes",
        });
      } else {
        toast.info(`Upload de "${titulo}" cancelado`);
      }
      setTimeout(() => useUploadStore.getState().remove(reuniaoId), 6000);
    }
  })();
}

/** Hook: retorna o job ativo para uma reunião, se houver. */
export function useUploadJob(reuniaoId: string | null | undefined): UploadJob | undefined {
  return useUploadStore((s) => (reuniaoId ? s.jobs[reuniaoId] : undefined));
}

/** Há algum job em andamento? (para beforeunload) */
export function hasActiveJobs(): boolean {
  const jobs = useUploadStore.getState().jobs;
  return Object.values(jobs).some(
    (j) => j.phase === "compressing" || j.phase === "uploading",
  );
}
