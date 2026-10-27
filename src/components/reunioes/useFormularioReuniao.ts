import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { TablesUpdate } from "@/integrations/supabase/types";
import {
  emptyForm,
  transcricaoQuery,
  type FormState,
  type ReuniaoLista,
} from "@/components/reunioes/reunioes-lib";

/** Estado e ações do formulário de criar/editar reunião. */
export function useFormularioReuniao(data: ReuniaoLista[]) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  // Form
  const [form, setForm] = React.useState<FormState>(emptyForm());
  // Áudio já enviado para o storage (caminho final). null = sem áudio.
  const [audioPath, setAudioPath] = React.useState<string | null>(null);
  const [audioSize, setAudioSize] = React.useState<number | null>(null);
  const [audioMime, setAudioMime] = React.useState<string | null>(null);
  const [audioUploadedThisSession, setAudioUploadedThisSession] = React.useState(false);
  // Transcrição colada à mão (ex.: "Copiar transcrição" do Gravador do iPhone), sem áudio.
  const [transcricaoColada, setTranscricaoColada] = React.useState(false);
  const [confirmApagarAudio, setConfirmApagarAudio] = React.useState(false);
  const [apagandoAudio, setApagandoAudio] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [analyzing, setAnalyzing] = React.useState(false);

  const resetAudioState = () => {
    setAudioPath(null);
    setAudioSize(null);
    setAudioMime(null);
    setAudioUploadedThisSession(false);
    setTranscricaoColada(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    resetAudioState();
    setFormOpen(true);
  };

  const openEdit = async (r: ReuniaoLista) => {
    // O salvar grava a transcrição do formulário: sem ela carregada, o formulário não abre.
    let transcricao = "";
    if (r.temTranscricao) {
      try {
        transcricao = await qc.fetchQuery({ ...transcricaoQuery(r.id), staleTime: 0 });
      } catch (e) {
        toast.error("Não foi possível abrir a reunião", { description: getErrorMessage(e) });
        return;
      }
    }
    setEditingId(r.id);
    setForm({
      titulo: r.titulo ?? "",
      tipo: r.tipo ?? "interna",
      status: r.status ?? "agendada",
      data_reuniao: r.data_reuniao
        ? new Date(r.data_reuniao).toISOString().slice(0, 16)
        : new Date().toISOString().slice(0, 16),
      duracao_min: r.duracao_min ?? 60,
      pauta: r.pauta ?? "",
      resumo: r.resumo ?? "",
      proximos_passos: r.proximos_passos ?? "",
      transcricao,
      link_calendario: r.link_calendario ?? "",
      participantes_str: (r.participantes ?? []).join(", "),
      responsaveis_ids: r.responsaveis_ids ?? [],
      equipe_toda: !!r.equipe_toda,
    });
    setAudioPath(r.audio_path ?? null);
    setAudioSize(r.audio_size ?? null);
    setAudioMime(r.audio_mime ?? null);
    setAudioUploadedThisSession(false);
    setFormOpen(true);
  };

  // Encontra a reunião atual em edição (para status de transcrição em tempo real)
  const editingRow = React.useMemo(
    () => (editingId ? data.find((r) => r.id === editingId) : null),
    [editingId, data],
  );

  // Cria rascunho da reunião (usado pelo upload em segundo plano antes de enfileirar).
  const handleAutoSaveDraft = async (): Promise<string | null> => {
    if (!user) {
      toast.error("Faça login para anexar áudio");
      return null;
    }
    if (editingId) return editingId;
    if (!form.titulo.trim()) {
      toast.error("Informe um título antes de anexar o áudio");
      return null;
    }
    const { participantes_str, ...rest } = form;
    const participantes = participantes_str
      ? participantes_str
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : null;
    const { data: inserted, error } = await supabase
      .from("reuniao")
      .insert({
        ...rest,
        data_reuniao: new Date(form.data_reuniao).toISOString(),
        duracao_min: Number(form.duracao_min) || null,
        responsaveis_ids: form.responsaveis_ids,
        equipe_toda: form.equipe_toda,
        participantes,
        criado_por: user.id,
      })
      .select("id")
      .single();
    if (error || !inserted) {
      toast.error("Erro ao salvar rascunho", { description: error?.message });
      return null;
    }
    setEditingId(inserted.id);
    qc.invalidateQueries({ queryKey: ["reunioes"] });
    return inserted.id;
  };

  /**
   * Análise a partir da transcrição colada (Gravador do iPhone, 06/10/2026): grava o texto na
   * reunião e chama só a análise da IA. Não usa áudio nem a transcrição do Groq.
   */
  const handleAnalisarTranscricaoColada = async () => {
    if (!user) {
      toast.error("Faça login para iniciar a análise");
      return;
    }
    if (!form.titulo.trim()) {
      toast.error("Informe um título antes de iniciar a análise");
      return;
    }
    if (!form.transcricao.trim()) {
      toast.error("Cole a transcrição antes de iniciar a análise");
      return;
    }
    setAnalyzing(true);
    try {
      const rid = editingId ?? (await handleAutoSaveDraft());
      if (!rid) return;
      const { error: upErr } = await supabase
        .from("reuniao")
        .update({ transcricao: form.transcricao })
        .eq("id", rid);
      if (upErr) {
        toast.error("Erro ao salvar a transcrição", { description: upErr.message });
        return;
      }
      const { error: fnError } = await supabase.functions.invoke("analisar-transcricao", {
        body: { reuniao_id: rid },
      });
      if (fnError) {
        toast.error("Falha na análise por IA", { description: fnError.message });
      } else {
        setTranscricaoColada(false);
        toast.success("Análise pronta", {
          description: "Pauta, resumo e próximos passos foram preenchidos. Revise e salve.",
        });
      }
      qc.invalidateQueries({ queryKey: ["reunioes"] });
    } finally {
      setAnalyzing(false);
    }
  };

  /** Apaga o arquivo de áudio e mantém transcrição e análise. Irreversível. */
  const handleApagarAudio = async () => {
    if (!editingId || !audioPath) return;
    setApagandoAudio(true);
    try {
      const { data: removidos, error } = await supabase.storage
        .from("reuniao-audios")
        .remove([audioPath]);
      // Sem permissão, o Storage não dá erro: só devolve a lista vazia.
      if (error || !removidos || removidos.length === 0) {
        toast.error("Não foi possível apagar o áudio", {
          description: error?.message ?? "Só gestores podem apagar áudios de reunião.",
        });
        return;
      }
      const { error: upErr } = await supabase
        .from("reuniao")
        .update({ audio_path: null, audio_size: null, audio_mime: null })
        .eq("id", editingId);
      if (upErr) {
        toast.error("O áudio foi apagado, mas a reunião não foi atualizada", {
          description: upErr.message,
        });
        return;
      }
      const mb = audioSize ? ` (${(audioSize / 1048576).toFixed(1)} MB liberados)` : "";
      resetAudioState();
      toast.success(`Áudio apagado${mb}. Transcrição e análise continuam na reunião.`);
      qc.invalidateQueries({ queryKey: ["reunioes"] });
    } finally {
      setApagandoAudio(false);
      setConfirmApagarAudio(false);
    }
  };

  const handleEarlyAnalysis = async () => {
    if (!user) {
      toast.error("Faça login para iniciar a análise");
      return;
    }
    if (!audioPath) {
      toast.error("Anexe um áudio antes de iniciar a análise");
      return;
    }
    if (!form.titulo.trim()) {
      toast.error("Informe um título antes de iniciar a análise");
      return;
    }
    setAnalyzing(true);
    try {
      // Se ainda é criação, cria rascunho para podermos atrelar a transcrição
      let rid = editingId;
      if (!rid) {
        const { participantes_str, ...rest } = form;
        const participantes = participantes_str
          ? participantes_str
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : null;
        const { data: inserted, error } = await supabase
          .from("reuniao")
          .insert({
            ...rest,
            data_reuniao: new Date(form.data_reuniao).toISOString(),
            duracao_min: Number(form.duracao_min) || null,
            responsaveis_ids: form.responsaveis_ids,
            equipe_toda: form.equipe_toda,
            participantes,
            audio_path: audioPath,
            audio_size: audioSize,
            audio_mime: audioMime,
            criado_por: user.id,
          })
          .select("id")
          .single();
        if (error || !inserted) {
          toast.error("Erro ao criar rascunho", { description: error?.message });
          return;
        }
        rid = inserted.id;
        setEditingId(rid);
        setAudioUploadedThisSession(false);
      }
      const { error: fnError } = await supabase.functions.invoke("transcrever-reuniao", {
        body: { reuniao_id: rid, audio_path: audioPath },
      });
      if (fnError) {
        toast.error("Falha ao iniciar análise", { description: fnError.message });
      } else {
        toast.info("🎧 Transcrevendo e analisando com IA...", {
          description:
            "Os campos serão preenchidos automaticamente. Continue editando e salve depois.",
        });
      }
      qc.invalidateQueries({ queryKey: ["reunioes"] });
    } finally {
      setAnalyzing(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim() || !user) {
      toast.error(user ? "Informe título" : "Faça login para criar reuniões");
      return;
    }
    setSaving(true);

    const { participantes_str, ...rest } = form;
    const participantes = participantes_str
      ? participantes_str
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : null;

    let savedId = editingId;

    if (editingId) {
      const updatePayload: TablesUpdate<"reuniao"> = {
        ...rest,
        data_reuniao: new Date(form.data_reuniao).toISOString(),
        duracao_min: Number(form.duracao_min) || null,
        responsaveis_ids: form.responsaveis_ids,
        equipe_toda: form.equipe_toda,
        participantes,
        audio_path: audioPath,
        audio_size: audioSize,
        audio_mime: audioMime,
      };
      const { error } = await supabase.from("reuniao").update(updatePayload).eq("id", editingId);
      if (error) {
        setSaving(false);
        toast.error("Erro ao atualizar", { description: error.message });
        return;
      }
      toast.success("Reunião atualizada");
    } else {
      const { data: inserted, error } = await supabase
        .from("reuniao")
        .insert({
          ...rest,
          data_reuniao: new Date(form.data_reuniao).toISOString(),
          duracao_min: Number(form.duracao_min) || null,
          responsaveis_ids: form.responsaveis_ids,
          equipe_toda: form.equipe_toda,
          participantes,
          audio_path: audioPath,
          audio_size: audioSize,
          audio_mime: audioMime,
          criado_por: user.id,
        })
        .select("id")
        .single();
      if (error || !inserted) {
        setSaving(false);
        toast.error("Erro ao salvar", { description: error?.message });
        return;
      }
      savedId = inserted.id;
      toast.success("Reunião registrada");
    }

    // Transcrição colada nesta sessão e ainda não analisada: analisa ao salvar.
    if (savedId && transcricaoColada && form.transcricao.trim() && !audioUploadedThisSession) {
      supabase.functions
        .invoke("analisar-transcricao", { body: { reuniao_id: savedId } })
        .then(({ error }) => {
          if (error) toast.error("Falha na análise por IA", { description: error.message });
          else
            toast.info("✨ Analisando a transcrição com IA...", {
              description: "A reunião será atualizada automaticamente.",
            });
        });
    }

    // Se o áudio foi anexado nesta sessão e ainda não foi processado, dispara IA
    if (savedId && audioPath && audioUploadedThisSession) {
      supabase.functions
        .invoke("transcrever-reuniao", {
          body: { reuniao_id: savedId, audio_path: audioPath },
        })
        .then(({ error }) => {
          if (error) toast.error("Falha ao iniciar análise IA", { description: error.message });
          else
            toast.info("🎧 Transcrevendo e analisando com IA...", {
              description: "A reunião será atualizada automaticamente.",
            });
        });
    }

    setSaving(false);
    setFormOpen(false);
    resetAudioState();
    setEditingId(null);
    setForm(emptyForm());
    qc.invalidateQueries({ queryKey: ["reunioes"] });
    qc.invalidateQueries({ queryKey: ["dash-reunioes"] });
    qc.invalidateQueries({ queryKey: ["dash-atribuicoes"] });
  };

  return {
    formOpen,
    setFormOpen,
    editingId,
    editingRow,
    form,
    setForm,
    audioPath,
    setAudioPath,
    audioSize,
    setAudioSize,
    setAudioMime,
    setAudioUploadedThisSession,
    setTranscricaoColada,
    confirmApagarAudio,
    setConfirmApagarAudio,
    apagandoAudio,
    saving,
    analyzing,
    openCreate,
    openEdit,
    handleAutoSaveDraft,
    handleAnalisarTranscricaoColada,
    handleApagarAudio,
    handleEarlyAnalysis,
    onSubmit,
  };
}

export type FormularioReuniao = ReturnType<typeof useFormularioReuniao>;
