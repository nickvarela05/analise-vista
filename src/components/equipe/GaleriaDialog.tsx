import * as React from "react";
import { Loader2, Trash2, Images } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

  const { data: fotos = [], isLoading } = useQuery({
    queryKey: ["galeria-equipe"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaborador_galeria")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Foto[];
    },
    enabled: open,
  });

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
    const { error } = await supabase.from("colaborador_galeria").insert({
      foto_url: pub.publicUrl,
      legenda: legenda.trim() || null,
      ordem: 0,
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
              <Input
                type="file"
                accept="image/*"
                onChange={onUpload}
                disabled={uploading}
              />
              {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : fotos.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <Images className="h-8 w-8 opacity-50" />
            Nenhuma foto na galeria ainda.
          </div>
        ) : (
          <div className="grid max-h-[60vh] gap-3 overflow-y-auto sm:grid-cols-2 md:grid-cols-3">
            {fotos.map((f) => (
              <div key={f.id} className="group relative overflow-hidden rounded-md border bg-card">
                <img
                  src={f.foto_url}
                  alt={f.legenda ?? "Foto da equipe"}
                  className="h-44 w-full object-cover"
                />
                {f.legenda && (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground line-clamp-2">
                    {f.legenda}
                  </p>
                )}
                {canManage && (
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="absolute right-1.5 top-1.5 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => remover(f.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
