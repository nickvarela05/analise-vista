import { Loader2, Trash2, Sparkles, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { AssigneeCombobox } from "@/components/AssigneeCombobox";
import { UploadAudioReuniao } from "@/components/reunioes/UploadAudioReuniao";
import { DialogHero } from "@/components/shared/DialogHero";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { AssigneeOption } from "@/components/AssigneeCombobox";
import { STATUS, TIPOS } from "@/components/reunioes/reunioes-lib";
import type { FormularioReuniao } from "@/components/reunioes/useFormularioReuniao";

/** Diálogo de criar/editar reunião. */
export function ReuniaoFormDialog({
  formulario,
  colabs,
}: {
  formulario: FormularioReuniao;
  colabs: AssigneeOption[];
}) {
  const { user } = useAuth();
  const {
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
    handleAutoSaveDraft,
    handleAnalisarTranscricaoColada,
    handleApagarAudio,
    handleEarlyAnalysis,
    onSubmit,
  } = formulario;
  return (
    <>
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="w-[95vw] sm:max-w-3xl lg:max-w-4xl max-h-[92vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <DialogHeader className="sr-only">
            <DialogTitle>{editingId ? "Editar reunião" : "Nova reunião"}</DialogTitle>
          </DialogHeader>
          <DialogHero
            icon={Video}
            tone="violet"
            eyebrow="Reuniões"
            title={editingId ? "Editar reunião" : "Nova reunião"}
            description={
              editingId
                ? "Atualize informações, anexe áudio e re-execute a transcrição se necessário."
                : "Agende uma reunião e, opcionalmente, anexe áudio para transcrição automática."
            }
          />
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v) => setForm({ ...form, tipo: v as typeof form.tipo })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Data e hora</Label>
                <Input
                  type="datetime-local"
                  value={form.data_reuniao}
                  onChange={(e) => setForm({ ...form, data_reuniao: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Duração (min)</Label>
                <Input
                  type="number"
                  value={form.duracao_min}
                  onChange={(e) => setForm({ ...form, duracao_min: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Atribuir a</Label>
                <AssigneeCombobox
                  options={colabs}
                  selectedIds={form.responsaveis_ids}
                  equipeToda={form.equipe_toda}
                  onChange={(n) =>
                    setForm({ ...form, responsaveis_ids: n.selectedIds, equipe_toda: n.equipeToda })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Link do calendário</Label>
                <Input
                  value={form.link_calendario}
                  onChange={(e) => setForm({ ...form, link_calendario: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Participantes (separados por vírgula)</Label>
              <Input
                value={form.participantes_str}
                onChange={(e) => setForm({ ...form, participantes_str: e.target.value })}
                placeholder="João, Maria, Pedro"
              />
            </div>

            {/* Upload de áudio + análise IA — disponível em criação e edição */}
            {user && (
              <UploadAudioReuniao
                reuniaoId={editingId}
                userId={user.id}
                titulo={form.titulo}
                audioPath={audioPath}
                status={editingRow?.transcricao_status ?? "pendente"}
                errorMessage={editingRow?.transcricao_erro ?? null}
                onUploaded={async (info) => {
                  setAudioPath(info.audio_path || null);
                  setAudioSize(info.audio_size || null);
                  setAudioMime(info.audio_mime || null);
                  // Já foi disparado pelo manager — não reprocessar no submit
                  setAudioUploadedThisSession(false);
                }}
                onAutoSaveDraft={handleAutoSaveDraft}
              />
            )}

            {/* Alternativa ao áudio: colar a transcrição pronta (ex.: Gravador do iPhone). */}
            {!audioPath && (
              <div className="space-y-1.5 rounded-md border border-dashed p-3">
                <Label htmlFor="reuniao-transcricao-colada" className="flex items-center gap-1.5">
                  Ou cole a transcrição
                  <span className="text-[11px] font-normal text-muted-foreground">
                    (Gravador do iPhone: abra a gravação → transcrição → Copiar transcrição)
                  </span>
                </Label>
                <Textarea
                  id="reuniao-transcricao-colada"
                  rows={6}
                  className="min-h-[120px] resize-y font-mono text-xs"
                  value={form.transcricao}
                  onChange={(e) => {
                    setForm({ ...form, transcricao: e.target.value });
                    setTranscricaoColada(true);
                  }}
                  placeholder="Cole aqui o texto da reunião. Não precisa enviar o áudio: a IA gera pauta, resumo e próximos passos a partir do texto."
                />
                <p className="text-[11px] text-muted-foreground">
                  Economiza espaço: o texto ocupa uma fração do áudio.
                </p>
              </div>
            )}

            {editingId && audioPath && editingRow?.transcricao_status !== "processando" && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs">
                <span className="text-muted-foreground">
                  {form.transcricao.trim()
                    ? `A transcrição já está salva. O áudio${audioSize ? ` (${(audioSize / 1048576).toFixed(1)} MB)` : ""} pode ser apagado para liberar espaço.`
                    : "O áudio ainda não foi transcrito. Apague só se não for precisar dele."}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmApagarAudio(true)}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Apagar áudio
                </Button>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                Pauta
                {form.pauta && (audioPath || form.transcricao) && (
                  <Badge
                    variant="outline"
                    className="border-primary/30 bg-primary/5 text-[10px] text-primary"
                  >
                    <Sparkles className="mr-1 h-2.5 w-2.5" /> IA
                  </Badge>
                )}
              </Label>
              <Textarea
                rows={6}
                className="min-h-[140px] resize-y leading-relaxed"
                value={form.pauta}
                onChange={(e) => setForm({ ...form, pauta: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                Resumo
                {form.resumo && (audioPath || form.transcricao) && (
                  <Badge
                    variant="outline"
                    className="border-primary/30 bg-primary/5 text-[10px] text-primary"
                  >
                    <Sparkles className="mr-1 h-2.5 w-2.5" /> IA
                  </Badge>
                )}
              </Label>
              <Textarea
                rows={6}
                className="min-h-[140px] resize-y leading-relaxed"
                value={form.resumo}
                onChange={(e) => setForm({ ...form, resumo: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                Próximos passos
                {form.proximos_passos && (audioPath || form.transcricao) && (
                  <Badge
                    variant="outline"
                    className="border-primary/30 bg-primary/5 text-[10px] text-primary"
                  >
                    <Sparkles className="mr-1 h-2.5 w-2.5" /> IA
                  </Badge>
                )}
              </Label>
              <Textarea
                rows={5}
                className="min-h-[120px] resize-y leading-relaxed"
                value={form.proximos_passos}
                onChange={(e) => setForm({ ...form, proximos_passos: e.target.value })}
              />
            </div>
            {form.transcricao && audioPath && (
              <Accordion type="single" collapsible>
                <AccordionItem value="transcricao" className="rounded-md border px-3">
                  <AccordionTrigger className="text-sm">
                    📝 Ver transcrição completa
                  </AccordionTrigger>
                  <AccordionContent>
                    <Textarea
                      rows={8}
                      value={form.transcricao}
                      onChange={(e) => setForm({ ...form, transcricao: e.target.value })}
                      className="font-mono text-xs"
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="secondary"
                disabled={
                  analyzing ||
                  (!audioPath && !form.transcricao.trim()) ||
                  editingRow?.transcricao_status === "processando"
                }
                onClick={audioPath ? handleEarlyAnalysis : handleAnalisarTranscricaoColada}
              >
                {analyzing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {audioPath ? "Iniciar análise por IA" : "Analisar transcrição com IA"}
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingId ? "Salvar alterações" : "Salvar"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmar apagar só o áudio */}
      <AlertDialog
        open={confirmApagarAudio}
        onOpenChange={(v) => !apagandoAudio && setConfirmApagarAudio(v)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar o áudio desta reunião?</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo de áudio é apagado de vez e não pode ser recuperado. A reunião, a
              transcrição, a pauta, o resumo e os próximos passos continuam salvos.
              {!form.transcricao.trim() && " Atenção: este áudio ainda não foi transcrito."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={apagandoAudio}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Mantém o diálogo aberto até terminar; ele fecha no fim de handleApagarAudio.
                e.preventDefault();
                void handleApagarAudio();
              }}
              disabled={apagandoAudio}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {apagandoAudio && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apagar áudio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
