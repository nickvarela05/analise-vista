import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, FileBarChart, RefreshCw, Search, Mail, Calendar } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
import { supabase } from "@/integrations/supabase/client";
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
  if (v === "crítica" || v === "critica") return "bg-destructive/15 text-destructive border-destructive/30";
  if (v === "alta") return "bg-warning/20 text-warning-foreground border-warning/30";
  if (v === "média" || v === "media") return "bg-primary/10 text-primary border-primary/20";
  return "bg-muted text-muted-foreground";
}

function statusVariant(s: string | null) {
  const v = (s ?? "").toLowerCase();
  if (v === "enviado" || v === "finalizado" || v === "concluído" || v === "concluido")
    return "bg-success/15 text-success border-success/30";
  if (v === "feito" || v === "encaminhado" || v === "em andamento")
    return "bg-info/15 text-info border-info/30";
  if (v === "pendente") return "bg-warning/20 text-warning-foreground border-warning/40";
  return "bg-muted text-muted-foreground";
}

function Relatorios() {
  const qc = useQueryClient();
  const [categoria, setCategoria] = React.useState<string>("todas");
  const [search, setSearch] = React.useState("");

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["solicitacoes-relatorios"],
    queryFn: () => listSolicitacoesRelatorios(),
    refetchOnWindowFocus: false,
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["relatorios-colaboradores"],
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
    mutationFn: (vars: { id: string; responsavel?: string | null; status?: StatusSolicitacao }) =>
      updateSolicitacaoRelatorio({ data: vars }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error("Erro ao atualizar", { description: res.error });
        return;
      }
      toast.success("Atualizado");
      qc.invalidateQueries({ queryKey: ["solicitacoes-relatorios"] });
    },
    onError: (e: Error) => toast.error("Erro ao atualizar", { description: e.message }),
  });

  const rows: SolicitacaoRelatorio[] = data?.ok ? data.rows : [];

  const categorias = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const cat = (r.categoria ?? "Indefinido").trim() || "Indefinido";
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
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
  }, [rows, categoria, search]);

  return (
    <div>
      <PageHeader
        title="Relatórios"
        description="Solicitações de relatórios sincronizadas do banco externo (N8N)."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => qc.invalidateQueries({ queryKey: ["solicitacoes-relatorios"] })}
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

      {/* Resumo por categoria */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <button
          type="button"
          onClick={() => setCategoria("todas")}
          className={`rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${
            categoria === "todas" ? "border-primary bg-primary/5" : "border-border"
          }`}
        >
          <div className="text-2xl font-semibold">{rows.length}</div>
          <div className="text-xs text-muted-foreground">Todas</div>
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

      <Card className="overflow-x-auto">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error || (data && !data.ok) ? (
          <div className="p-6 text-sm text-destructive">
            Erro ao carregar: {(error as Error)?.message ?? (data && !data.ok ? data.error : "desconhecido")}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileBarChart}
            title="Nenhuma solicitação"
            description="Nenhum registro encontrado com os filtros atuais."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Solicitante</TableHead>
                <TableHead className="min-w-[280px]">Descrição</TableHead>
                <TableHead>Urgência</TableHead>
                <TableHead className="min-w-[160px]">Responsável</TableHead>
                <TableHead className="min-w-[140px]">Status</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Recebido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Badge variant="outline" className="bg-muted/50">
                      {r.categoria ?? "Indefinido"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.tipo_base ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{r.solicitante_nome ?? "—"}</span>
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
                    <p className="line-clamp-2 text-sm" title={r.descricao ?? ""}>
                      {r.descricao ?? "—"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize ${urgenciaVariant(r.urgencia)}`}>
                      {r.urgencia ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={r.responsavel ?? "__none__"}
                      onValueChange={(v) =>
                        updateMut.mutate({ id: r.id, responsavel: v === "__none__" ? null : v })
                      }
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
                      value={(STATUS_SOLICITACAO as readonly string[]).includes(r.status ?? "")
                        ? (r.status as string)
                        : "Pendente"}
                      onValueChange={(v) =>
                        updateMut.mutate({ id: r.id, status: v as StatusSolicitacao })
                      }
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
