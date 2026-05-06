import * as React from "react";
import { Loader2, Trash2, Images, GripVertical, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

interface Foto {
  id: string;
  foto_url: string;
  legenda: string | null;
  ordem: number;
}

interface Props {
  canManage: boolean;
  trigger?: React.ReactNode;
}

export function GaleriaDialog({ canManage, trigger }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [legenda, setLegenda] = React.useState("");
  const [items, setItems] = React.useState<Foto[]>([]);

  const { data: fotos, isLoading } = useQuery({
    queryKey: ["galeria-equipe"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaborador_galeria")
        .select("*")
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Foto[];
    },
    enabled: open,
  });

  React.useEffect(() => {
    if (fotos) setItems(fotos);
  }, [fotos]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    const { error } = await supabase
      .from("colaborador_galeria")
      .upsert(next.map((f, i) => ({ id: f.id, foto_url: f.foto_url, ordem: i })));
    if (error) {
      toast.error("Erro ao reordenar", { description: error.message });
      qc.invalidateQueries({ queryKey: ["galeria-equipe"] });
    }
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem maior que 5MB");
      return;
    }
    setUploading(true);
    const path = `galeria/equipe/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage
      .from("colaborador-fotos")
      .upload(path, file);
    if (upErr) {
      setUploading(false);
      toast.error("Erro no upload", { description: upErr.message });
      return;
    }
    const { data: pub } = supabase.storage.from("colaborador-fotos").getPublicUrl(path);
    const maxOrdem = items.reduce((m, f) => Math.max(m, f.ordem), -1);
    const { error } = await supabase.from("colaborador_galeria").insert({
      foto_url: pub.publicUrl,
      legenda: legenda.trim() || null,
      ordem: maxOrdem + 1,
    });
    setUploading(false);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    setLegenda("");
    toast.success("Foto adicionada");
    qc.invalidateQueries({ queryKey: ["galeria-equipe"] });
  };

  const remover = async (id: string) => {
    const { error } = await supabase.from("colaborador_galeria").delete().eq("id", id);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    toast.success("Foto removida");
    qc.invalidateQueries({ queryKey: ["galeria-equipe"] });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <Images className="mr-2 h-4 w-4" /> Galeria
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Galeria da equipe</DialogTitle>
        </DialogHeader>

        {canManage && (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <Label className="text-xs">Adicionar foto</Label>
            <Input
              placeholder="Legenda (opcional)"
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <Input type="file" accept="image/*" onChange={onUpload} disabled={uploading} />
              {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {items.length > 1 && (
              <p className="text-[11px] text-muted-foreground">
                Dica: arraste as fotos para reordenar.
              </p>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <Images className="h-8 w-8 opacity-50" />
            Nenhuma foto na galeria ainda.
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
              <div className="grid max-h-[60vh] gap-3 overflow-y-auto sm:grid-cols-2 md:grid-cols-3">
                {items.map((f) => (
                  <SortableFoto
                    key={f.id}
                    foto={f}
                    canManage={canManage}
                    onRemove={() => remover(f.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SortableFoto({
  foto,
  canManage,
  onRemove,
}: {
  foto: Foto;
  canManage: boolean;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: foto.id,
    disabled: !canManage,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative overflow-hidden rounded-md border bg-card"
    >
      {canManage && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="absolute left-1.5 top-1.5 z-10 flex h-7 w-7 cursor-grab items-center justify-center rounded-md bg-background/80 opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          aria-label="Arrastar foto"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}
      <img
        src={foto.foto_url}
        alt={foto.legenda ?? "Foto da equipe"}
        className="h-44 w-full object-cover"
        draggable={false}
      />
      {foto.legenda && (
        <p className="line-clamp-2 px-2 py-1.5 text-xs text-muted-foreground">{foto.legenda}</p>
      )}
      {canManage && (
        <Button
          type="button"
          size="icon"
          variant="destructive"
          className="absolute right-1.5 top-1.5 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
