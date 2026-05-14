import { createFileRoute } from "@tanstack/react-router";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  FileBarChart,
  RefreshCw,
  Search,
  Mail,
  Calendar,
  EyeOff,
  Eye,
  ChevronDown,
  ChevronRight,
  User,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { qk } from "@/lib/queries/keys";
import {
  listSolicitacoesRelatorios,
  updateSolicitacaoRelatorio,
  STATUS_SOLICITACAO,
  type SolicitacaoRelatorio,
  type StatusSolicitacao,
} from "@/server/n8n-db.functions";
import { NovoRelatorioDialog } from "@/components/relatorios/NovoRelatorioDialog";

export const Route = createFileRoute("/relatorios")({
  errorComponent: RouteErrorBoundary,
  component: RelatoriosRoute,
});

function RelatoriosRoute() {
  return (
    <AppLayout>
      <Relatorios />
    </AppLayout>
  );
}

function urgenciaVariant(u: string | null) {
  const v = (u ?? "").toLowerCase();
  if (v === "crítica" || v === "critica")
    return "bg-destructive/15 text-destructive border-destructive/30";
  if (v === "alta") return "bg-warning/20 text-warning border-warning/30";
  if (v === "média" || v === "media") return "bg-primary/10 text-primary border-primary/20";
  return "bg-muted text-muted-foreground";
}

function statusVariant(s: string | null) {
  const v = (s ?? "").toLowerCase();
  if (v === "enviado" || v === "finalizado" || v === "concluído" || v === "concluido")
    return "bg-success/15 text-success border-success/30";
  if (v === "feito" || v === "encaminhado" || v === "em andamento")
    return "bg-info/15 text-info border-info/30";
  if (v === "pendente") return "bg-warning/20 text-warning border-warning/40";
  return "bg-muted text-muted-foreground";
}

type RowExt = SolicitacaoRelatorio & { _inativo: boolean };

function Relatorios() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [categoria, setCategoria] = React.useState<string>("todas");
  const [search, setSearch] = React.useState("");
  const [mostrarInativos, setMostrarInativos] = React.useState(true);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: qk.relatorios.solicitacoes(),
    queryFn: () => listSolicitacoesRelatorios(),
    refetchOnWindowFocus: false,
  });

  const { data: inativos = [] } = useQuery({
    queryKey: qk.relatorios.inativos(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("relatorio_inativo")
        .select("solicitacao_id");
      if (error) throw error;
      return (data ?? []).map((r) => r.solicitacao_id);
    },
  });

  const inativosSet = React.useMemo(() => new Set(inativos), [inativos]);

  const { data: colaboradores = [] } = useQuery({
    queryKey: qk.relatorios.colaboradores(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaborador")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateMut = useMutation({
    mutationFn: (vars: {
      id: string;
      responsavel?: string | null;
      status?: StatusSolicitacao;
    }) => updateSolicitacaoRelatorio({ data: vars }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error("Erro ao atualizar", { description: res.error });
        return;
      }
      toast.success("Atualizado");
      qc.invalidateQueries({ queryKey: qk.relatorios.solicitacoes() });
    },
    onError: (e: Error) => toast.error("Erro ao atualizar", { description: e.message }),
  });

  const toggleAtivoMut = useMutation({
    mutationFn: async (vars: { solicitacaoId: string; ativarNovamente: boolean }) => {
      if (vars.ativarNovamente) {
        const { error } = await supabase
          .from("relatorio_inativo")
          .delete()
          .eq("solicitacao_id", vars.solicitacaoId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("relatorio_inativo").insert({
          solicitacao_id: vars.solicitacaoId,
          inativado_por: user?.id ?? null,
          inativado_por_nome: user?.email ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.relatorios.inativos() });
    },
    onError: (e: Error) => toast.error("Erro ao alternar status", { description: e.message }),
  });

  const rows: RowExt[] = React.useMemo(
    () =>
      (data?.ok ? data.rows : []).map((r) => ({
        ...r,
        _inativo: inativosSet.has(r.id),
      })),
    [data, inativosSet],
  );

  // Categorias contam somente as ATIVAS
  const categorias = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      if (r._inativo) continue;
      const cat = (r.categoria ?? "Indefinido").trim() || "Indefinido";
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  const totalAtivas = rows.filter((r) => !r._inativo).length;

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!mostrarInativos && r._inativo) return false;
      const cat = (r.categoria ?? "Indefinido").trim() || "Indefinido";
      if (categoria !== "todas" && cat !== categoria) return false;
      if (!q) return true;
      return (
        (r.descricao ?? "").toLowerCase().includes(q) ||
        (r.solicitante_nome ?? "").toLowerCase().includes(q) ||
        (r.solicitante_email ?? "").toLowerCase().includes(q) ||
        (r.tipo_base ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, categoria, search, mostrarInativos]);

  // Agrupa por categoria
  const grupos = React.useMemo(() => {
    const map = new Map<string, RowExt[]>();
    for (const r of filtered) {
      const cat = (r.categoria ?? "Indefinido").trim() || "Indefinido";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(r);
    }
    return Array.from(map.entries())
      .map(([nome, items]) => ({
        nome,
        items,
        ativos: items.filter((i) => !i._inativo).length,
      }))
      .sort((a, b) => b.ativos - a.ativos || a.nome.localeCompare(b.nome));
  }, [filtered]);

  return (
    <div>
      <PageHeader
        title="Relatórios"
        description="Solicitações de relatórios sincronizadas do banco externo (N8N)."
        actions={
          <>
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5">
              <Switch
                id="mostrar-inativos"
                checked={mostrarInativos}
                onCheckedChange={setMostrarInativos}
              />
              <Label htmlFor="mostrar-inativos" className="cursor-pointer text-xs">
                Mostrar inativas
              </Label>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                qc.invalidateQueries({ queryKey: qk.relatorios.solicitacoes() });
                qc.invalidateQueries({ queryKey: qk.relatorios.inativos() });
              }}
              disabled={isFetching}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <NovoRelatorioDialog
              categoriasExistentes={categorias.map((c) => c.nome)}
              colaboradores={colaboradores}
            />
          </>
        }
      />

      {/* Resumo por categoria — só conta ATIVAS */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <button
          type="button"
          onClick={() => setCategoria("todas")}
          className={`rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${
            categoria === "todas" ? "border-primary bg-primary/5" : "border-border"
          }`}
        >
          <div className="text-2xl font-semibold">{totalAtivas}</div>
          <div className="text-xs text-muted-foreground">Todas (ativas)</div>
        </button>
        {categorias.map((c) => (
          <button
            type="button"
            key={c.nome}
            onClick={() => setCategoria(c.nome)}
            className={`rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${
              categoria === c.nome ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <div className="text-2xl font-semibold">{c.total}</div>
            <div className="truncate text-xs text-muted-foreground" title={c.nome}>
              {c.nome}
            </div>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição, solicitante, e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {categorias.map((c) => (
              <SelectItem key={c.nome} value={c.nome}>
                {c.nome} ({c.total})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Card>
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </Card>
      ) : error || (data && !data.ok) ? (
        <Card>
          <div className="p-6 text-sm text-destructive">
            Erro ao carregar:{" "}
            {(error as Error)?.message ?? (data && !data.ok ? data.error : "desconhecido")}
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileBarChart}
            title="Nenhuma solicitação"
            description="Nenhum registro encontrado com os filtros atuais."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {grupos.map((g) => (
            <CategoriaSecao
              key={g.nome}
              nome={g.nome}
              ativos={g.ativos}
              total={g.items.length}
              items={g.items}
              colaboradores={colaboradores}
              expanded={expanded}
              onToggleExpand={(id) =>
                setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
              }
              onUpdate={(vars) => updateMut.mutate(vars)}
              onToggleAtivo={(id, ativarNovamente) =>
                toggleAtivoMut.mutate({ solicitacaoId: id, ativarNovamente })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoriaSecao({
  nome,
  ativos,
  total,
  items,
  colaboradores,
  expanded,
  onToggleExpand,
  onUpdate,
  onToggleAtivo,
}: {
  nome: string;
  ativos: number;
  total: number;
  items: RowExt[];
  colaboradores: { id: string; nome: string }[];
  expanded: Record<string, boolean>;
  onToggleExpand: (id: string) => void;
  onUpdate: (vars: { id: string; responsavel?: string | null; status?: StatusSolicitacao }) => void;
  onToggleAtivo: (id: string, ativarNovamente: boolean) => void;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline gap-3 px-1">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{nome}</h2>
        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
          {ativos} ativas
        </Badge>
        {total > ativos && (
          <span className="text-xs text-muted-foreground">
            {total - ativos} inativa{total - ativos > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <Separator className="mb-3" />
      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Tipo</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead className="min-w-[280px]">Descrição</TableHead>
              <TableHead>Urgência</TableHead>
              <TableHead className="min-w-[160px]">Responsável</TableHead>
              <TableHead className="min-w-[140px]">Status</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead>Recebido</TableHead>
              <TableHead className="w-24 text-right">Ativa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => {
              const isOpen = !!expanded[r.id];
              return (
                <React.Fragment key={r.id}>
                  <TableRow
                    className={cn(
                      "transition-opacity",
                      r._inativo && "opacity-50 bg-muted/30",
                    )}
                  >
                    <TableCell className="p-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onToggleExpand(r.id)}
                        aria-label={isOpen ? "Fechar detalhes" : "Abrir detalhes"}
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.tipo_base ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={cn(
                            "text-sm font-medium",
                            r._inativo && "line-through",
                          )}
                        >
                          {r.solicitante_nome ?? "—"}
                        </span>
                        {r.solicitante_email && (
                          <a
                            href={`mailto:${r.solicitante_email}`}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                          >
                            <Mail className="h-3 w-3" />
                            {r.solicitante_email}
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p
                        className={cn(
                          "line-clamp-2 text-sm",
                          r._inativo && "line-through",
                        )}
                        title={r.descricao ?? ""}
                      >
                        {r.descricao ?? "—"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`capitalize ${urgenciaVariant(r.urgencia)}`}
                      >
                        {r.urgencia ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={r.responsavel ?? "__none__"}
                        onValueChange={(v) =>
                          onUpdate({
                            id: r.id,
                            responsavel: v === "__none__" ? null : v,
                          })
                        }
                        disabled={r._inativo}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Atribuir..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Sem responsável —</SelectItem>
                          {colaboradores.map((c) => (
                            <SelectItem key={c.id} value={c.nome}>
                              {c.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={
                          (STATUS_SOLICITACAO as readonly string[]).includes(r.status ?? "")
                            ? (r.status as string)
                            : "Pendente"
                        }
                        onValueChange={(v) =>
                          onUpdate({ id: r.id, status: v as StatusSolicitacao })
                        }
                        disabled={r._inativo}
                      >
                        <SelectTrigger className={`h-8 text-xs ${statusVariant(r.status)}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_SOLICITACAO.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.prazo ? format(new Date(r.prazo), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {r.criado_em ? format(new Date(r.criado_em), "dd/MM/yyyy HH:mm") : "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Switch
                          checked={!r._inativo}
                          onCheckedChange={() => onToggleAtivo(r.id, r._inativo)}
                          aria-label={r._inativo ? "Reativar" : "Inativar"}
                        />
                        {r._inativo ? (
                          <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <Eye className="h-3.5 w-3.5 text-success" />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableCell colSpan={10} className="p-0">
                      <Collapsible open={isOpen}>
                        <CollapsibleContent>
                          <DetalhesEmail row={r} />
                        </CollapsibleContent>
                      </Collapsible>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </section>
  );
}

function DetalhesEmail({ row }: { row: RowExt }) {
  return (
    <div className="border-t border-dashed border-border bg-muted/30 px-6 py-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div>
            <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Mail className="h-3.5 w-3.5" />
              Conteúdo do e-mail
            </h4>
            <div className="whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-sm leading-relaxed text-foreground">
              {row.detalhes_email || row.descricao || "Sem conteúdo disponível."}
            </div>
          </div>
          {row.justificativa_urgencia && (
            <div>
              <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5" />
                Justificativa da urgência
              </h4>
              <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-foreground">
                {row.justificativa_urgencia}
              </div>
            </div>
          )}
        </div>
        <div className="space-y-2 text-sm">
          <DetalheLinha icon={<User className="h-3.5 w-3.5" />} label="Solicitante">
            {row.solicitante_nome ?? "—"}
          </DetalheLinha>
          <DetalheLinha icon={<Mail className="h-3.5 w-3.5" />} label="E-mail">
            {row.solicitante_email ? (
              <a
                href={`mailto:${row.solicitante_email}`}
                className="text-primary hover:underline"
              >
                {row.solicitante_email}
              </a>
            ) : (
              "—"
            )}
          </DetalheLinha>
          <DetalheLinha label="ID do e-mail">
            <span className="font-mono text-xs">{row.email_id ?? "—"}</span>
          </DetalheLinha>
          <DetalheLinha label="Categoria">{row.categoria ?? "—"}</DetalheLinha>
          <DetalheLinha label="Tipo base">{row.tipo_base ?? "—"}</DetalheLinha>
          <DetalheLinha label="Prazo">
            {row.prazo ? format(new Date(row.prazo), "dd/MM/yyyy") : "—"}
          </DetalheLinha>
          <DetalheLinha label="Recebido em">
            {row.criado_em ? format(new Date(row.criado_em), "dd/MM/yyyy HH:mm") : "—"}
          </DetalheLinha>
        </div>
      </div>
    </div>
  );
}

function DetalheLinha({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-1.5 last:border-0">
      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-right text-sm text-foreground">{children}</span>
    </div>
  );
}
