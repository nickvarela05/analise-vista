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

/** Formata um campo `date` (YYYY-MM-DD) sem aplicar timezone — evita o "−1 dia" comum em pt-BR. */
function fmtPrazo(s: string | null) {
  if (!s) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return format(new Date(s), "dd/MM/yyyy");
}

function urgenciaVariant(u: string | null) {
  const v = (u ?? "").toLowerCase();
  if (v === "crítica" || v === "critica")
    return "bg-destructive/15 text-destructive border-destructive/30";
  if (v === "alta") return "bg-warning/20 text-warning border-warning/30";
  if (v === "média" || v === "media") return "bg-primary/10 text-primary border-primary/20";
  return "bg-muted text-muted-foreground";
}

function urgenciaPeso(u: string | null) {
  const v = (u ?? "").toLowerCase();
  if (v === "crítica" || v === "critica") return 4;
  if (v === "alta") return 3;
  if (v === "média" || v === "media") return 2;
  if (v === "baixa") return 1;
  return 0;
}

function isSolicitacaoCat(nome: string) {
  return nome.toLowerCase().includes("solicit");
}

function isAtrasado(r: SolicitacaoRelatorio) {
  if (!r.prazo) return false;
  if ((r.status ?? "").toLowerCase() === "enviado") return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(r.prazo);
  if (!m) return false;
  const prazo = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return prazo < hoje;
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

const CATEGORIAS_SUGERIDAS = [
  "Solicitação de Relatório",
  "Notificação",
  "Resposta",
  "Informativo",
  "Outros",
] as const;

type RowExt = SolicitacaoRelatorio & { _inativo: boolean };

function Relatorios() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [categoria, setCategoria] = React.useState<string>("todas");
  const [search, setSearch] = React.useState("");
  const [mostrarInativos, setMostrarInativos] = React.useState(false);
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
      categoria?: string | null;
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
        const { data: deleted, error } = await supabase
          .from("relatorio_inativo")
          .delete()
          .eq("solicitacao_id", vars.solicitacaoId)
          .select("id");
        if (error) throw error;
        return { reativado: (deleted ?? []).length > 0 };
      } else {
        const { error } = await supabase.from("relatorio_inativo").insert({
          solicitacao_id: vars.solicitacaoId,
          inativado_por: user?.id ?? null,
          inativado_por_nome: user?.email ?? null,
        });
        if (error) throw error;
        return { reativado: false };
      }
    },
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: qk.relatorios.inativos() });
      if (vars.ativarNovamente) {
        if (res?.reativado) {
          toast.success("Relatório reativado");
        } else {
          toast.info("Nada para reativar", {
            description:
              "Este item pode estar inativo por estar com status 'Enviado'. Altere o status para reativá-lo.",
          });
        }
      } else {
        toast.success("Relatório inativado");
      }
    },
    onError: (e: Error) => toast.error("Erro ao alternar status", { description: e.message }),
  });

  const rows: RowExt[] = React.useMemo(
    () =>
      (data?.ok ? data.rows : []).map((r) => {
        // Solicitantes "Google" (nome ou e-mail) são inativados automaticamente.
        const nome = (r.solicitante_nome ?? "").toLowerCase();
        const email = (r.solicitante_email ?? "").toLowerCase();
        const isGoogle =
          nome === "google" ||
          nome.includes("google") ||
          /@(.*\.)?google\.com$/.test(email);
        return {
          ...r,
          // "Enviado" e solicitantes Google são considerados inativos automaticamente.
          _inativo:
            inativosSet.has(r.id) ||
            (r.status ?? "").toLowerCase() === "enviado" ||
            isGoogle,
        };
      }),
    [data, inativosSet],
  );

  // Categorias contam somente as ATIVAS
  const categorias = React.useMemo(() => {
    const counts = new Map<string, { total: number; enviados: number; atrasados: number }>();
    for (const r of rows) {
      const cat = (r.categoria ?? "Indefinido").trim() || "Indefinido";
      const cur = counts.get(cat) ?? { total: 0, enviados: 0, atrasados: 0 };
      const enviado = (r.status ?? "").toLowerCase() === "enviado";
      if (!r._inativo) cur.total += 1;
      if (enviado) cur.enviados += 1;
      if (!r._inativo && isAtrasado(r)) cur.atrasados += 1;
      counts.set(cat, cur);
    }
    return Array.from(counts.entries())
      .map(([nome, m]) => ({ nome, ...m }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  const totalAtivas = rows.filter((r) => !r._inativo).length;

  const categoriasDisponiveis = React.useMemo(() => {
    const set = new Set<string>(CATEGORIAS_SUGERIDAS);
    for (const c of categorias) set.add(c.nome);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [categorias]);

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

      {/* Resumo por categoria — só conta ATIVAS. Categorias de solicitação ganham métricas extras. */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
        {categorias.map((c) => {
          const isSolic = isSolicitacaoCat(c.nome);
          const selected = categoria === c.nome;
          return (
            <button
              type="button"
              key={c.nome}
              onClick={() => setCategoria(c.nome)}
              className={`rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${
                selected ? "border-primary bg-primary/5" : "border-border"
              } ${isSolic ? "sm:col-span-2" : ""}`}
            >
              {isSolic ? (
                <div className="space-y-2">
                  <div
                    className="truncate text-xs font-medium text-muted-foreground"
                    title={c.nome}
                  >
                    {c.nome}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className="text-2xl font-semibold leading-none">{c.total}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">Solicitações</div>
                    </div>
                    <div>
                      <div className="text-2xl font-semibold leading-none text-success">
                        {c.enviados}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">Enviados</div>
                    </div>
                    <div>
                      <div className="text-2xl font-semibold leading-none text-destructive">
                        {c.atrasados}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">Atrasados</div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-2xl font-semibold">{c.total}</div>
                  <div className="truncate text-xs text-muted-foreground" title={c.nome}>
                    {c.nome}
                  </div>
                </>
              )}
            </button>
          );
        })}
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
              categoriasDisponiveis={categoriasDisponiveis}
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

type RowHandlers = {
  colaboradores: { id: string; nome: string }[];
  categoriasDisponiveis: string[];
  expanded: Record<string, boolean>;
  onToggleExpand: (id: string) => void;
  onUpdate: (vars: {
    id: string;
    responsavel?: string | null;
    status?: StatusSolicitacao;
    categoria?: string | null;
  }) => void;
  onToggleAtivo: (id: string, ativarNovamente: boolean) => void;
};

function CategoriaSecao({
  nome,
  ativos,
  total,
  items,
  ...handlers
}: {
  nome: string;
  ativos: number;
  total: number;
  items: RowExt[];
} & RowHandlers) {
  const isSolic = isSolicitacaoCat(nome);

  // Ordena por prioridade (urgência) desc, depois prazo asc, depois recebido desc.
  const sortByPrio = React.useCallback((arr: RowExt[]) => {
    return [...arr].sort((a, b) => {
      const d = urgenciaPeso(b.urgencia) - urgenciaPeso(a.urgencia);
      if (d !== 0) return d;
      const pa = a.prazo ?? "9999-12-31";
      const pb = b.prazo ?? "9999-12-31";
      if (pa !== pb) return pa.localeCompare(pb);
      return (b.criado_em ?? "").localeCompare(a.criado_em ?? "");
    });
  }, []);

  const itemsSorted = React.useMemo(() => sortByPrio(items), [items, sortByPrio]);

  const novas = React.useMemo(
    () => itemsSorted.filter((r) => !(r.responsavel ?? "").trim()),
    [itemsSorted],
  );
  const atribuidas = React.useMemo(
    () => itemsSorted.filter((r) => !!(r.responsavel ?? "").trim()),
    [itemsSorted],
  );

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

      {isSolic ? (
        <div className="space-y-4">
          <SubGrupo titulo="Novas solicitações" count={novas.length} tone="warning">
            {novas.length === 0 ? (
              <EmptyMini text="Nenhuma solicitação aguardando atribuição." />
            ) : (
              <RelatorioTable items={novas} {...handlers} />
            )}
          </SubGrupo>
          <SubGrupo titulo="Já atribuídas" count={atribuidas.length} tone="info">
            {atribuidas.length === 0 ? (
              <EmptyMini text="Nenhuma solicitação atribuída ainda." />
            ) : (
              <RelatorioTable items={atribuidas} {...handlers} />
            )}
          </SubGrupo>
        </div>
      ) : (
        <RelatorioTable items={itemsSorted} {...handlers} />
      )}
    </section>
  );
}

function SubGrupo({
  titulo,
  count,
  tone,
  children,
}: {
  titulo: string;
  count: number;
  tone: "warning" | "info";
  children: React.ReactNode;
}) {
  const toneCls =
    tone === "warning"
      ? "bg-warning/10 text-warning border-warning/30"
      : "bg-info/10 text-info border-info/30";
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 px-1">
        <h3 className="text-sm font-medium text-foreground">{titulo}</h3>
        <Badge variant="outline" className={toneCls}>
          {count}
        </Badge>
      </div>
      {children}
    </div>
  );
}

function EmptyMini({ text }: { text: string }) {
  return (
    <Card className="p-4 text-center text-xs text-muted-foreground">{text}</Card>
  );
}

function RelatorioTable({
  items,
  colaboradores,
  categoriasDisponiveis,
  expanded,
  onToggleExpand,
  onUpdate,
  onToggleAtivo,
}: { items: RowExt[] } & RowHandlers) {
  return (
    <Card className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead className="min-w-[160px]">Categoria</TableHead>
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
            const catAtual = (r.categoria ?? "Indefinido").trim() || "Indefinido";
            const opcoesCat = Array.from(new Set([catAtual, ...categoriasDisponiveis]));
            return (
              <React.Fragment key={r.id}>
                <TableRow
                  className={cn("transition-opacity", r._inativo && "opacity-50 bg-muted/30")}
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
                  <TableCell>
                    <Select
                      value={catAtual}
                      onValueChange={(v) => onUpdate({ id: r.id, categoria: v })}
                      disabled={r._inativo}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {opcoesCat.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.tipo_base ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span
                        className={cn("text-sm font-medium", r._inativo && "line-through")}
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
                      className={cn("line-clamp-2 text-sm", r._inativo && "line-through")}
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
                    {fmtPrazo(r.prazo)}
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
                  <TableCell colSpan={11} className="p-0">
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
            {fmtPrazo(row.prazo)}
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
