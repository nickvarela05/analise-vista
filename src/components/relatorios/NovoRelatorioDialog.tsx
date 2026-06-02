import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createSolicitacaoRelatorio,
  STATUS_SOLICITACAO,
  type StatusSolicitacao,
} from "@/server/n8n-db.functions";
} from "@/lib/n8n-db.functions";

const URGENCIAS = ["Baixa", "Média", "Alta", "Crítica"] as const;

export function NovoRelatorioDialog({
  categoriasExistentes,
  colaboradores,
}: {
  categoriasExistentes: string[];
  colaboradores: { id: string; nome: string }[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    categoria: "",
    categoriaCustom: "",
    tipo_base: "",
    solicitante_nome: "",
    solicitante_email: "",
    descricao: "",
    urgencia: "Média",
    prazo: "",
    responsavel: "__none__",
    status: "Pendente" as StatusSolicitacao,
  });

  const reset = () =>
    setForm({
      categoria: "",
      categoriaCustom: "",
      tipo_base: "",
      solicitante_nome: "",
      solicitante_email: "",
      descricao: "",
      urgencia: "Média",
      prazo: "",
      responsavel: "__none__",
      status: "Pendente",
    });

  const mut = useMutation({
    mutationFn: (vars: Parameters<typeof createSolicitacaoRelatorio>[0]["data"]) =>
      createSolicitacaoRelatorio({ data: vars }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error("Erro ao criar relatório", { description: res.error });
        return;
      }
      toast.success("Relatório adicionado");
      qc.invalidateQueries({ queryKey: ["solicitacoes-relatorios"] });
      setOpen(false);
      reset();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.descricao.trim()) {
      toast.error("Descrição é obrigatória");
      return;
    }
    const categoria =
      form.categoria === "__nova__"
        ? form.categoriaCustom.trim() || "Indefinido"
        : form.categoria || "Indefinido";

    mut.mutate({
      categoria,
      tipo_base: form.tipo_base.trim() || null,
      solicitante_nome: form.solicitante_nome.trim() || null,
      solicitante_email: form.solicitante_email.trim() || null,
      descricao: form.descricao.trim(),
      urgencia: form.urgencia || null,
      prazo: form.prazo || null,
      responsavel: form.responsavel === "__none__" ? null : form.responsavel,
      status: form.status,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo relatório
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Inclusão manual de relatório</DialogTitle>
          <DialogDescription>
            O registro será incluído na contabilidade geral junto às demais solicitações.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select
              value={form.categoria}
              onValueChange={(v) => setForm({ ...form, categoria: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {categoriasExistentes.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
                <SelectItem value="__nova__">+ Nova categoria…</SelectItem>
              </SelectContent>
            </Select>
            {form.categoria === "__nova__" && (
              <Input
                placeholder="Nome da nova categoria"
                value={form.categoriaCustom}
                onChange={(e) => setForm({ ...form, categoriaCustom: e.target.value })}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Input
              value={form.tipo_base}
              onChange={(e) => setForm({ ...form, tipo_base: e.target.value })}
              placeholder="Ex.: Operacional"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Solicitante</Label>
            <Input
              value={form.solicitante_nome}
              onChange={(e) => setForm({ ...form, solicitante_nome: e.target.value })}
              placeholder="Nome"
            />
          </div>

          <div className="space-y-1.5">
            <Label>E-mail do solicitante</Label>
            <Input
              type="email"
              value={form.solicitante_email}
              onChange={(e) => setForm({ ...form, solicitante_email: e.target.value })}
              placeholder="email@empresa.com"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>
              Descrição <span className="text-destructive">*</span>
            </Label>
            <Textarea
              required
              rows={3}
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder="Descreva o relatório solicitado"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Urgência</Label>
            <Select value={form.urgencia} onValueChange={(v) => setForm({ ...form, urgencia: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {URGENCIAS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Prazo</Label>
            <Input
              type="date"
              value={form.prazo}
              onChange={(e) => setForm({ ...form, prazo: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Responsável</Label>
            <Select
              value={form.responsavel}
              onValueChange={(v) => setForm({ ...form, responsavel: v })}
            >
              <SelectTrigger>
                <SelectValue />
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
          </div>

          <div className="space-y-1.5">
            <Label>Status inicial</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm({ ...form, status: v as StatusSolicitacao })}
            >
              <SelectTrigger>
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
          </div>

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mut.isPending}>
              {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
