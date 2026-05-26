import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  Calendar,
  Loader2,
  MessageSquare,
  ListChecks,
  Paperclip,
  History,
  Plus,
  Trash2,
  Send,
  Download,
  Link2,
  FlaskConical,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AssigneeCombobox } from "@/components/AssigneeCombobox";
import { WORKFLOW, STATUS_LABEL, statusVariant, prioVariant, PRIO } from "./lib/workflow";

interface Props {
  tarefa: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colabs: { id: string; nome: string; cargo: string | null }[];
}

export function TarefaDrawer({ tarefa, open, onOpenChange, colabs }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["profile-self", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("nome")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });
  const [novoComentario, setNovoComentario] = React.useState("");
  const [novoChecklistItem, setNovoChecklistItem] = React.useState("");
  const [uploadingFile, setUploadingFile] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const id = tarefa?.id;

  // Estado local do formulário de edição (commit no botão Salvar)
  const [draft, setDraft] = React.useState({
    status: tarefa?.status ?? "",
    prioridade: tarefa?.prioridade ?? "",
    data_prevista: tarefa?.data_prevista ?? "",
    demanda_id: tarefa?.demanda_id ?? null,
    em_teste: tarefa?.em_teste ?? false,
    descricao: tarefa?.descricao ?? "",
  });

  React.useEffect(() => {
    setDraft({
      status: tarefa?.status ?? "",
      prioridade: tarefa?.prioridade ?? "",
      data_prevista: tarefa?.data_prevista ?? "",
      demanda_id: tarefa?.demanda_id ?? null,
      em_teste: tarefa?.em_teste ?? false,
      descricao: tarefa?.descricao ?? "",
    });
  }, [tarefa?.id, tarefa?.status, tarefa?.prioridade, tarefa?.data_prevista, tarefa?.demanda_id, tarefa?.em_teste, tarefa?.descricao]);

  const dirty =
    draft.status !== (tarefa?.status ?? "") ||
    draft.prioridade !== (tarefa?.prioridade ?? "") ||
    (draft.data_prevista ?? "") !== (tarefa?.data_prevista ?? "") ||
    (draft.demanda_id ?? null) !== (tarefa?.demanda_id ?? null) ||
    draft.em_teste !== (tarefa?.em_teste ?? false) ||
    (draft.descricao ?? "") !== (tarefa?.descricao ?? "");

  const { data: demandas = [] } = useQuery({
    queryKey: ["dem-list-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("demanda").select("id, titulo").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: comentarios = [] } = useQuery({
    queryKey: ["tar-coments", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("todo_comentario")
        .select("*")
        .eq("todo_id", id!)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: checklist = [] } = useQuery({
    queryKey: ["tar-checklist", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("todo_checklist")
        .select("*")
        .eq("todo_id", id!)
        .order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: anexos = [] } = useQuery({
    queryKey: ["tar-anexos", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("todo_anexo")
        .select("*")
        .eq("todo_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: historico = [] } = useQuery({
    queryKey: ["tar-historico", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("todo_historico")
        .select("*")
        .eq("todo_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!tarefa) return null;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["tarefas"] });
    qc.invalidateQueries({ queryKey: ["tar-coments", id] });
    qc.invalidateQueries({ queryKey: ["tar-checklist", id] });
    qc.invalidateQueries({ queryKey: ["tar-anexos", id] });
    qc.invalidateQueries({ queryKey: ["tar-historico", id] });
    qc.invalidateQueries({ queryKey: ["tar-counts"] });
  };

  const logHistorico = async (campo: string, antigo: any, novo: any) => {
    if (!user) return;
    await supabase.from("todo_historico").insert({
      todo_id: id,
      autor_id: user.id,
      autor_nome: profile?.nome ?? user.email,
      campo,
      valor_antigo: antigo ? String(antigo) : null,
      valor_novo: novo ? String(novo) : null,
    });
  };

  const updateField = async (field: string, novo: any) => {
    const antigo = (tarefa as any)[field];
    const updates: any = { [field]: novo };
    if (field === "status" && novo === "producao") updates.concluida_em = new Date().toISOString();
    if (field === "status" && novo !== "producao") updates.concluida_em = null;
    const { error } = await supabase.from("todo").update(updates).eq("id", id);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    await logHistorico(field, antigo, novo);
    invalidate();
  };

  const salvarEdicao = async () => {
    if (!dirty || !id) return;
    setSalvando(true);
    const updates: any = {
      status: draft.status,
      prioridade: draft.prioridade,
      data_prevista: draft.data_prevista || null,
      demanda_id: draft.demanda_id || null,
      em_teste: draft.em_teste,
      descricao: draft.descricao || null,
    };
    if (draft.status === "producao" && tarefa.status !== "producao") {
      updates.concluida_em = new Date().toISOString();
    } else if (draft.status !== "producao" && tarefa.status === "producao") {
      updates.concluida_em = null;
    }
    const { error } = await supabase.from("todo").update(updates).eq("id", id);
    setSalvando(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }
    const campos: Array<[string, unknown, unknown]> = [
      ["status", tarefa.status, draft.status],
      ["prioridade", tarefa.prioridade, draft.prioridade],
      ["data_prevista", tarefa.data_prevista, draft.data_prevista || null],
      ["demanda_id", tarefa.demanda_id, draft.demanda_id || null],
      ["em_teste", tarefa.em_teste, draft.em_teste],
      ["descricao", tarefa.descricao, draft.descricao || null],
    ];
    for (const [campo, antigo, novo] of campos) {
      if ((antigo ?? null) !== (novo ?? null)) await logHistorico(campo, antigo, novo);
    }
    toast.success("Tarefa atualizada");
    invalidate();
  };

  const adicionarComentario = async () => {
    if (!novoComentario.trim() || !user) return;
    const { error } = await supabase.from("todo_comentario").insert({
      todo_id: id,
      autor_id: user.id,
      autor_nome: profile?.nome ?? user.email,
      conteudo: novoComentario.trim(),
    });
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    setNovoComentario("");
    invalidate();
  };

  const adicionarChecklist = async () => {
    if (!novoChecklistItem.trim()) return;
    const { error } = await supabase.from("todo_checklist").insert({
      todo_id: id,
      texto: novoChecklistItem.trim(),
      ordem: checklist.length,
    });
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    setNovoChecklistItem("");
    invalidate();
  };

  const toggleChecklist = async (itemId: string, concluido: boolean) => {
    await supabase.from("todo_checklist").update({ concluido }).eq("id", itemId);
    invalidate();
  };

  const removerChecklist = async (itemId: string) => {
    await supabase.from("todo_checklist").delete().eq("id", itemId);
    invalidate();
  };

  const uploadAnexo = async (file: File) => {
    if (!user) return;
    setUploadingFile(true);
    const path = `${id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("tarefa-anexos").upload(path, file);
    if (upErr) {
      toast.error("Erro no upload", { description: upErr.message });
      setUploadingFile(false);
      return;
    }
    const { error } = await supabase.from("todo_anexo").insert({
      todo_id: id,
      autor_id: user.id,
      autor_nome: profile?.nome ?? user.email,
      nome_arquivo: file.name,
      storage_path: path,
      mime_type: file.type,
      tamanho_bytes: file.size,
    });
    setUploadingFile(false);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    invalidate();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const baixarAnexo = async (path: string, nome: string) => {
    const { data, error } = await supabase.storage.from("tarefa-anexos").createSignedUrl(path, 60);
    if (error || !data) {
      toast.error("Erro ao gerar link");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const removerAnexo = async (anexoId: string, path: string) => {
    await supabase.storage.from("tarefa-anexos").remove([path]);
    await supabase.from("todo_anexo").delete().eq("id", anexoId);
    invalidate();
  };

  const checklistDone = checklist.filter((c) => c.concluido).length;
  const checklistPct = checklist.length > 0 ? Math.round((checklistDone / checklist.length) * 100) : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
        <SheetHeader className="space-y-3 pr-10">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={`capitalize ${statusVariant(tarefa.status)}`}>
              {STATUS_LABEL[tarefa.status] ?? tarefa.status}
            </Badge>
            <Badge variant="outline" className={`capitalize ${prioVariant(tarefa.prioridade)}`}>
              {tarefa.prioridade}
            </Badge>
          </div>
          <SheetTitle className="text-base leading-snug sm:text-lg">
            {tarefa.titulo}
          </SheetTitle>
        </SheetHeader>

        {/* Painel rápido de edição */}
        <div className="mt-4 grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={draft.status} onValueChange={(v) => setDraft((d) => ({ ...d, status: v }))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WORKFLOW.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Prioridade</Label>
            <Select value={draft.prioridade} onValueChange={(v) => setDraft((d) => ({ ...d, prioridade: v }))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIO.map((p) => (
                  <SelectItem key={p} value={p} className="text-xs capitalize">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">
              Prazo <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              type="date"
              className="h-8 text-xs"
              value={draft.data_prevista ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, data_prevista: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Demanda vinculada</Label>
            <Select
              value={draft.demanda_id ?? "none"}
              onValueChange={(v) => setDraft((d) => ({ ...d, demanda_id: v === "none" ? null : v }))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Nenhuma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs">
                  Nenhuma
                </SelectItem>
                {demandas.map((d: any) => (
                  <SelectItem key={d.id} value={d.id} className="text-xs">
                    {d.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Atribuir a</Label>
            <AssigneeCombobox
              options={colabs}
              selectedIds={tarefa.responsaveis_ids ?? []}
              equipeToda={!!tarefa.equipe_toda}
              onChange={async (n) => {
                await supabase
                  .from("todo")
                  .update({ responsaveis_ids: n.selectedIds, equipe_toda: n.equipeToda })
                  .eq("id", id);
                await logHistorico("responsaveis", null, n.equipeToda ? "Equipe toda" : `${n.selectedIds.length} pessoa(s)`);
                invalidate();
              }}
            />
          </div>
          <label className="flex items-start gap-2 rounded-md border border-info/30 bg-info/5 p-2 sm:col-span-2 cursor-pointer hover:bg-info/10 transition">
            <Checkbox
              checked={draft.em_teste}
              onCheckedChange={(v) => setDraft((d) => ({ ...d, em_teste: v === true }))}
              className="mt-0.5"
            />
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <FlaskConical className="h-3.5 w-3.5 text-info" />
              Em teste
              <span className="text-muted-foreground font-normal">— tarefa sob teste/validação</span>
            </span>
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setDraft({
                  status: tarefa.status ?? "",
                  prioridade: tarefa.prioridade ?? "",
                  data_prevista: tarefa.data_prevista ?? "",
                  demanda_id: tarefa.demanda_id ?? null,
                  em_teste: tarefa.em_teste ?? false,
                  descricao: tarefa.descricao ?? "",
                })
              }
              disabled={!dirty || salvando}
            >
              Descartar
            </Button>
            <Button size="sm" onClick={salvarEdicao} disabled={!dirty || salvando}>
              {salvando ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Salvar
            </Button>
          </div>
        </div>

        <div className="mt-4 space-y-1.5">
          <Label className="text-xs">Descrição</Label>
          <Textarea
            value={draft.descricao ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, descricao: e.target.value }))}
            placeholder="Adicione uma descrição para a tarefa..."
            className="min-h-24 text-sm"
          />
        </div>

        <Tabs defaultValue="comentarios" className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="comentarios" className="text-xs">
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
              {comentarios.length || ""} Coments
            </TabsTrigger>
            <TabsTrigger value="checklist" className="text-xs">
              <ListChecks className="mr-1.5 h-3.5 w-3.5" />
              {checklist.length > 0 ? `${checklistDone}/${checklist.length}` : "Checklist"}
            </TabsTrigger>
            <TabsTrigger value="anexos" className="text-xs">
              <Paperclip className="mr-1.5 h-3.5 w-3.5" />
              {anexos.length || ""} Anexos
            </TabsTrigger>
            <TabsTrigger value="historico" className="text-xs">
              <History className="mr-1.5 h-3.5 w-3.5" />
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* COMENTÁRIOS */}
          <TabsContent value="comentarios" className="mt-3 space-y-3">
            <ScrollArea className="h-64 rounded-md border p-2">
              {comentarios.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">Nenhum comentário ainda.</p>
              ) : (
                <div className="space-y-3">
                  {comentarios.map((c) => (
                    <div key={c.id} className="flex gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="bg-primary/15 text-[10px] text-primary">
                          {(c.autor_nome ?? "?")
                            .split(" ")
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 rounded-md bg-muted/50 px-2.5 py-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium">{c.autor_nome}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(c.created_at), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap text-xs">{c.conteudo}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            <div className="flex gap-2">
              <Textarea
                rows={2}
                placeholder="Escreva um comentário..."
                value={novoComentario}
                onChange={(e) => setNovoComentario(e.target.value)}
                className="text-xs"
              />
              <Button size="sm" onClick={adicionarComentario} disabled={!novoComentario.trim()}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </TabsContent>

          {/* CHECKLIST */}
          <TabsContent value="checklist" className="mt-3 space-y-3">
            {checklist.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-medium">{checklistPct}%</span>
                </div>
                <Progress value={checklistPct} className="h-1.5" />
              </div>
            )}
            <div className="space-y-1.5">
              {checklist.map((item) => (
                <div key={item.id} className="group flex items-center gap-2 rounded-md border px-2 py-1.5">
                  <Checkbox
                    checked={item.concluido}
                    onCheckedChange={(v) => toggleChecklist(item.id, !!v)}
                  />
                  <span className={`flex-1 text-xs ${item.concluido ? "text-muted-foreground line-through" : ""}`}>
                    {item.texto}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 transition group-hover:opacity-100"
                    onClick={() => removerChecklist(item.id)}
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Novo item..."
                value={novoChecklistItem}
                onChange={(e) => setNovoChecklistItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), adicionarChecklist())}
                className="h-8 text-xs"
              />
              <Button size="sm" onClick={adicionarChecklist} disabled={!novoChecklistItem.trim()}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </TabsContent>

          {/* ANEXOS */}
          <TabsContent value="anexos" className="mt-3 space-y-3">
            <div className="space-y-1.5">
              {anexos.length === 0 ? (
                <p className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
                  Nenhum anexo
                </p>
              ) : (
                anexos.map((a) => (
                  <div key={a.id} className="group flex items-center gap-2 rounded-md border px-2 py-1.5">
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{a.nome_arquivo}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {a.autor_nome} · {format(new Date(a.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        {a.tamanho_bytes ? ` · ${(a.tamanho_bytes / 1024).toFixed(0)} KB` : ""}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => baixarAnexo(a.storage_path, a.nome_arquivo)}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 transition group-hover:opacity-100"
                      onClick={() => removerAnexo(a.id, a.storage_path)}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                ))
              )}
            </div>
            <div>
              <Input
                ref={fileInputRef}
                type="file"
                disabled={uploadingFile}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAnexo(f);
                }}
                className="h-8 text-xs"
              />
              {uploadingFile && (
                <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Enviando...
                </p>
              )}
            </div>
          </TabsContent>

          {/* HISTÓRICO */}
          <TabsContent value="historico" className="mt-3">
            <ScrollArea className="h-64 rounded-md border p-2">
              {historico.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">Sem alterações registradas.</p>
              ) : (
                <div className="space-y-2">
                  {historico.map((h) => (
                    <div key={h.id} className="flex items-start gap-2 text-xs">
                      <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <div className="flex-1">
                        <p>
                          <span className="font-medium">{h.autor_nome ?? "Sistema"}</span>{" "}
                          <span className="text-muted-foreground">alterou</span>{" "}
                          <span className="font-medium">{h.campo}</span>
                          {h.valor_novo && (
                            <>
                              {" "}
                              <span className="text-muted-foreground">para</span>{" "}
                              <span className="font-medium">{h.valor_novo}</span>
                            </>
                          )}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(h.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
