import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Users as UsersIcon, Search, Mail, Sparkles, Pencil, Trash2, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { EmptyState } from "@/components/EmptyState";
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
  DialogTrigger,
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
import { GaleriaDialog } from "@/components/equipe/GaleriaDialog";
import { GaleriaCarousel } from "@/components/equipe/GaleriaCarousel";

type Colaborador = {
  id: string;
  nome: string;
  cargo: string | null;
  email: string | null;
  bio: string | null;
  foto_url: string | null;
};

export const Route = createFileRoute("/portfolio")({
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
  const qc = useQueryClient();
  const isGestor = role === "gestor";
  const [open, setOpen] = React.useState(false);
  const [foto, setFoto] = React.useState<File | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [busca, setBusca] = React.useState("");
  const [form, setForm] = React.useState({ nome: "", cargo: "", bio: "", email: "" });

  const { data = [], isLoading } = useQuery({
    queryKey: ["colaboradores"],
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

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setSaving(true);

    let foto_url: string | null = null;
    if (foto) {
      const path = `team/${Date.now()}-${foto.name}`;
      const { error: upErr } = await supabase.storage
        .from("colaborador-fotos")
        .upload(path, foto);
      if (upErr) {
        setSaving(false);
        toast.error("Erro no upload", { description: upErr.message });
        return;
      }
      const { data: pub } = supabase.storage.from("colaborador-fotos").getPublicUrl(path);
      foto_url = pub.publicUrl;
    }

    const { error } = await supabase.from("colaborador").insert({ ...form, foto_url });
    setSaving(false);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    toast.success("Colaborador adicionado");
    setOpen(false);
    setFoto(null);
    setForm({ nome: "", cargo: "", bio: "", email: "" });
    qc.invalidateQueries({ queryKey: ["colaboradores"] });
  };

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-6 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <Badge variant="secondary" className="gap-1.5">
              <Sparkles className="h-3 w-3" /> Time de Análise de Requisitos
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Portfólio da Equipe
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Conheça o time, suas funções e os momentos que marcam nossa rotina.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <GaleriaDialog canManage={isGestor} />
            {isGestor && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" /> Novo colaborador
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Novo colaborador</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={criar} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Nome</Label>
                      <Input
                        value={form.nome}
                        onChange={(e) => setForm({ ...form, nome: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Cargo</Label>
                      <Input
                        value={form.cargo}
                        onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>E-mail</Label>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Bio</Label>
                      <Textarea
                        rows={3}
                        value={form.bio}
                        onChange={(e) => setForm({ ...form, bio: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Foto</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:max-w-md">
          <StatChip label="Colaboradores" value={data.length} />
          <StatChip label="Cargos distintos" value={cargosUnicos} />
        </div>
      </section>

      {/* Galeria */}
      <section className="mx-auto w-full max-w-4xl">
        <SectionHeader title="Galeria" subtitle="Momentos da equipe" />
        <GaleriaCarousel />
      </section>

      {/* Equipe */}
      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeader title="Equipe" subtitle={`${data.length} ${data.length === 1 ? "pessoa" : "pessoas"}`} />
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, cargo..."
              className="pl-9"
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
              <ColaboradorCard key={c.id} colaborador={c} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card/60 px-4 py-3 backdrop-blur">
      <p className="text-2xl font-semibold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
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
}: {
  colaborador: {
    id: string;
    nome: string;
    cargo: string | null;
    email: string | null;
    bio: string | null;
    foto_url: string | null;
  };
}) {
  const iniciais = c.nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");

  return (
    <Card className="group relative overflow-hidden border-border/60 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
      {/* Cover */}
      <div className="relative h-20 overflow-hidden bg-gradient-to-br from-primary/30 via-primary/10 to-accent/20">
        {c.foto_url && (
          <img
            src={c.foto_url}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-xl"
          />
        )}
      </div>
      <CardContent className="p-5">
        <Avatar className="-mt-12 h-16 w-16 ring-4 ring-card transition-transform group-hover:scale-105">
          {c.foto_url && <AvatarImage src={c.foto_url} alt={c.nome} />}
          <AvatarFallback className="bg-primary/10 text-base font-medium text-primary">
            {iniciais}
          </AvatarFallback>
        </Avatar>
        <div className="mt-3">
          <h3 className="truncate text-base font-semibold leading-tight">{c.nome}</h3>
          {c.cargo && (
            <Badge variant="secondary" className="mt-1.5 font-normal">
              {c.cargo}
            </Badge>
          )}
        </div>
        {c.bio && (
          <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{c.bio}</p>
        )}
        {c.email && (
          <a
            href={`mailto:${c.email}`}
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            <Mail className="h-3.5 w-3.5" />
            <span className="truncate">{c.email}</span>
          </a>
        )}
      </CardContent>
    </Card>
  );
}
