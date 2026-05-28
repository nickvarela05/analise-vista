import { createFileRoute } from "@tanstack/react-router";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Users as UsersIcon,
  Search,
  Pencil,
  Trash2,
  MoreVertical,
  Briefcase,
  Images,
  User as UserIcon,
  Type,
  ImagePlus,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { EmptyState } from "@/components/EmptyState";
import { PageHero } from "@/components/shared/PageHero";
import { DialogHero } from "@/components/shared/DialogHero";
import { DialogSection } from "@/components/shared/DialogSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { qk } from "@/lib/queries/keys";
import { GaleriaDialog } from "@/components/equipe/GaleriaDialog";
import { GaleriaCarousel } from "@/components/equipe/GaleriaCarousel";
import { cn } from "@/lib/utils";

type Colaborador = {
  id: string;
  nome: string;
  cargo: string | null;
  bio: string | null;
  foto_url: string | null;
};

export const Route = createFileRoute("/portfolio")({
  errorComponent: RouteErrorBoundary,
  component: PortfolioRoute,
});

function PortfolioRoute() {
  return (
    <AppLayout>
      <Portfolio />
    </AppLayout>
  );
}

function Portfolio() {
  const { role } = useAuth();
  const isGestor = role === "gestor";
  const [busca, setBusca] = React.useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: qk.colaboradores(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaborador")
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtrados = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        (c.cargo ?? "").toLowerCase().includes(q) ||
        (c.bio ?? "").toLowerCase().includes(q),
    );
  }, [data, busca]);

  const cargosUnicos = React.useMemo(
    () => Array.from(new Set(data.map((c) => c.cargo).filter(Boolean))).length,
    [data],
  );

  const comFoto = React.useMemo(
    () => data.filter((c) => !!c.foto_url).length,
    [data],
  );

  const comBio = React.useMemo(
    () => data.filter((c) => !!c.bio && c.bio.trim().length > 0).length,
    [data],
  );

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Time de Análise de Requisitos"
        title="Portfólio da Equipe"
        description="Conheça o time, suas funções e os momentos que marcam nossa rotina."
        icon={UsersIcon}
        tone="violet"
        actions={<GaleriaDialog canManage={isGestor} />}
        stats={[
          { icon: UsersIcon, label: "Colaboradores", value: data.length, tone: "violet" },
          { icon: Briefcase, label: "Cargos distintos", value: cargosUnicos, tone: "indigo" },
          { icon: ImagePlus, label: "Com foto", value: comFoto, tone: "rose" },
          { icon: Type, label: "Com bio", value: comBio, tone: "primary" },
        ]}
        statsGridClassName="grid-cols-2 sm:grid-cols-4"
      />

      {/* Galeria */}
      <section className="mx-auto w-full max-w-6xl">
        <div className="mb-4 text-center">
          <h2 className="flex items-center justify-center gap-2 text-lg font-semibold tracking-tight">
            <Images className="h-4 w-4 text-fuchsia-500" />
            Galeria
          </h2>
          <p className="text-xs text-muted-foreground">Momentos da equipe</p>
        </div>
        <GaleriaCarousel />
      </section>

      {/* Equipe */}
      <section>
        <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-card/60 p-2.5 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 px-1">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-violet-500/15 text-violet-600 ring-1 ring-violet-500/25 dark:text-violet-300">
              <UsersIcon className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-sm font-semibold tracking-tight">Equipe</h2>
            <Badge variant="secondary" className="font-normal">
              {data.length} {data.length === 1 ? "pessoa" : "pessoas"}
            </Badge>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, cargo..."
              className="h-9 pl-9 focus-visible:ring-violet-500/40"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title={busca ? "Nenhum resultado" : "Nenhum colaborador cadastrado"}
            description={busca ? "Tente buscar por outro termo." : undefined}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtrados.map((c) => (
              <ColaboradorCard key={c.id} colaborador={c} canManage={isGestor} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SkeletonCard() {
  return (
    <Card className="overflow-hidden">
      <div className="h-20 animate-pulse bg-muted/60" />
      <CardContent className="p-5">
        <div className="-mt-10 mb-3 h-16 w-16 animate-pulse rounded-full bg-muted ring-4 ring-card" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-muted/70" />
      </CardContent>
    </Card>
  );
}

function ColaboradorCard({
  colaborador: c,
  canManage,
}: {
  colaborador: Colaborador;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [excluindo, setExcluindo] = React.useState(false);

  const iniciais = c.nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");

  const excluir = async () => {
    setExcluindo(true);
    const { error } = await supabase.from("colaborador").delete().eq("id", c.id);
    setExcluindo(false);
    if (error) {
      toast.error("Erro ao excluir", { description: error.message });
      return;
    }
    toast.success("Colaborador excluído");
    setConfirmOpen(false);
    qc.invalidateQueries({ queryKey: qk.colaboradores() });
  };

  return (
    <Card
      className={cn(
        "group relative overflow-hidden border-border/60 transition-all",
        "hover:-translate-y-0.5 hover:border-violet-500/40 hover:shadow-lg hover:shadow-violet-500/10",
      )}
    >
      {/* Cover */}
      <div className="relative h-24 overflow-hidden bg-gradient-to-br from-violet-500/30 via-fuchsia-500/15 to-indigo-500/20">
        {c.foto_url && (
          <img
            src={c.foto_url}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-xl"
          />
        )}
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-fuchsia-500/20 blur-2xl" />
        {canManage && (
          <div className="absolute right-2 top-2 z-10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 rounded-full bg-background/80 shadow-sm backdrop-blur hover:bg-background"
                  aria-label="Ações"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="mr-2 h-4 w-4" /> Editar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setConfirmOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      <CardContent className="p-5">
        <Avatar className="-mt-12 h-16 w-16 ring-4 ring-card transition-transform group-hover:scale-105">
          {c.foto_url && <AvatarImage src={c.foto_url} alt={c.nome} />}
          <AvatarFallback className="bg-violet-500/15 text-base font-medium text-violet-600 dark:text-violet-300">
            {iniciais}
          </AvatarFallback>
        </Avatar>
        <div className="mt-3">
          <h3 className="truncate text-base font-semibold leading-tight">{c.nome}</h3>
          {c.cargo && (
            <Badge
              variant="secondary"
              className="mt-1.5 border-violet-500/20 bg-violet-500/10 font-normal text-violet-700 dark:text-violet-300"
            >
              {c.cargo}
            </Badge>
          )}
        </div>
        {c.bio && (
          <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{c.bio}</p>
        )}
      </CardContent>

      {canManage && (
        <>
          <EditarColaboradorDialog
            colaborador={c}
            open={editOpen}
            onOpenChange={setEditOpen}
          />
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir colaborador?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. {c.nome} será removido permanentemente do portfólio.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    excluir();
                  }}
                  disabled={excluindo}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {excluindo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </Card>
  );
}

function EditarColaboradorDialog({
  colaborador,
  open,
  onOpenChange,
}: {
  colaborador: Colaborador;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [salvando, setSalvando] = React.useState(false);
  const [foto, setFoto] = React.useState<File | null>(null);
  const [form, setForm] = React.useState({
    nome: colaborador.nome,
    cargo: colaborador.cargo ?? "",
    bio: colaborador.bio ?? "",
  });

  React.useEffect(() => {
    if (open) {
      setForm({
        nome: colaborador.nome,
        cargo: colaborador.cargo ?? "",
        bio: colaborador.bio ?? "",
      });
      setFoto(null);
    }
  }, [open, colaborador]);

  const iniciais = form.nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");

  const previewUrl = React.useMemo(() => {
    if (foto) return URL.createObjectURL(foto);
    return colaborador.foto_url;
  }, [foto, colaborador.foto_url]);

  React.useEffect(() => {
    return () => {
      if (foto && previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [foto, previewUrl]);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setSalvando(true);

    let foto_url = colaborador.foto_url;
    if (foto) {
      const path = `team/${Date.now()}-${foto.name}`;
      const { error: upErr } = await supabase.storage
        .from("colaborador-fotos")
        .upload(path, foto);
      if (upErr) {
        setSalvando(false);
        toast.error("Erro no upload", { description: upErr.message });
        return;
      }
      const { data: pub } = supabase.storage.from("colaborador-fotos").getPublicUrl(path);
      foto_url = pub.publicUrl;
    }

    const { error } = await supabase
      .from("colaborador")
      .update({
        nome: form.nome,
        cargo: form.cargo || null,
        bio: form.bio || null,
        foto_url,
      })
      .eq("id", colaborador.id);

    setSalvando(false);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    toast.success("Colaborador atualizado");
    onOpenChange(false);
    qc.invalidateQueries({ queryKey: qk.colaboradores() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Editar colaborador</DialogTitle>
        </DialogHeader>

        <div className="px-6 pt-6">
          <DialogHero
            icon={UserIcon}
            tone="violet"
            eyebrow="Portfólio · Colaborador"
            title={colaborador.nome}
            description="Atualize informações de cargo, biografia e foto de perfil."
            chips={
              colaborador.cargo ? (
                <Badge
                  variant="outline"
                  className="gap-1 border-violet-500/40 bg-violet-500/10 text-[10px] text-violet-700 dark:text-violet-300"
                >
                  <Briefcase className="h-3 w-3" />
                  {colaborador.cargo}
                </Badge>
              ) : null
            }
          />
        </div>

        <form onSubmit={salvar} className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
          <DialogSection title="Identidade" icon={UserIcon}>
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20 ring-4 ring-violet-500/15">
                {previewUrl && <AvatarImage src={previewUrl} alt={form.nome} />}
                <AvatarFallback className="bg-violet-500/15 text-lg font-medium text-violet-600 dark:text-violet-300">
                  {iniciais || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs">
                  <ImagePlus className="mr-1 inline h-3 w-3" />
                  Foto{" "}
                  {colaborador.foto_url && (
                    <span className="text-[10px] font-normal text-muted-foreground">
                      (deixe vazio para manter)
                    </span>
                  )}
                </Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
                  className="cursor-pointer file:cursor-pointer focus-visible:ring-violet-500/40"
                />
                {foto && (
                  <p className="text-[10px] text-muted-foreground">
                    Nova foto será aplicada ao salvar.
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="focus-visible:ring-violet-500/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  <Briefcase className="mr-1 inline h-3 w-3" />
                  Cargo
                </Label>
                <Input
                  value={form.cargo}
                  onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                  placeholder="Ex.: Analista de Requisitos"
                  className="focus-visible:ring-violet-500/40"
                />
              </div>
            </div>
          </DialogSection>

          <DialogSection title="Biografia" icon={Type} variant="tinted">
            <div className="space-y-1.5">
              <Label className="text-xs">Bio</Label>
              <Textarea
                rows={4}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="Conte um pouco sobre essa pessoa, sua trajetória e seu papel no time..."
                className="resize-none focus-visible:ring-violet-500/40"
              />
            </div>
          </DialogSection>

          <DialogFooter className="sticky bottom-0 -mx-6 gap-2 border-t bg-card/70 px-6 py-3 backdrop-blur">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={salvando}
              className="bg-violet-500 text-white hover:bg-violet-600"
            >
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
