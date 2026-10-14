import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  comentarioObservacao,
  exigeObservacao,
  STATUS_COM_OBSERVACAO,
} from "./lib/observacaoTeste";

const MINIMO = 5;

type Pedido = { status: string; quantidade: number; resolver: (texto: string | null) => void };

/**
 * Pede a observação do teste antes de marcar "com ressalvas" ou "reprovado" (T3).
 *
 * Uso: `const obs = useObservacaoTeste();` … `const texto = await obs.pedir(status, n)`;
 * `null` = cancelou (não muda o status). Depois do update, `obs.gravar(...)` salva o comentário.
 * Renderize `obs.dialogo` em algum lugar da tela.
 */
export function useObservacaoTeste() {
  const [pedido, setPedido] = React.useState<Pedido | null>(null);
  const [texto, setTexto] = React.useState("");

  const pedir = React.useCallback((status: string, quantidade = 1) => {
    if (!exigeObservacao(status)) return Promise.resolve("");
    setTexto("");
    return new Promise<string | null>((resolver) => setPedido({ status, quantidade, resolver }));
  }, []);

  const fechar = (valor: string | null) => {
    pedido?.resolver(valor);
    setPedido(null);
  };

  const gravar = React.useCallback(
    async (
      user: { id: string; email?: string | null },
      ids: string[],
      status: string,
      obs: string,
    ) => {
      if (!exigeObservacao(status) || !obs.trim() || ids.length === 0) return;
      const { data: perfil } = await supabase
        .from("profiles")
        .select("nome")
        .eq("user_id", user.id)
        .maybeSingle();
      const { error } = await supabase.from("todo_comentario").insert(
        ids.map((id) => ({
          todo_id: id,
          autor_id: user.id,
          autor_nome: perfil?.nome ?? user.email ?? null,
          conteudo: comentarioObservacao(status, obs),
        })),
      );
      if (error) {
        toast.warning("Status alterado, mas a observação não foi salva", {
          description: error.message,
        });
      }
    },
    [],
  );

  const valido = texto.trim().length >= MINIMO;
  const rotulo = pedido ? STATUS_COM_OBSERVACAO[pedido.status] : "";

  const dialogo = (
    <Dialog open={!!pedido} onOpenChange={(v) => !v && fechar(null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Observação do teste: {rotulo}</DialogTitle>
          <DialogDescription>
            {pedido && pedido.quantidade > 1
              ? `Vale para as ${pedido.quantidade} tarefas selecionadas. `
              : ""}
            Escreva o que falta ou o que deu errado. Ela fica como comentário na tarefa e já entra
            preenchida no e-mail do Fechar rodada.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={
            pedido?.status === "reprovado"
              ? "Ex.: ao salvar a exoneração, a tela mostra erro 500 (matrícula 174520)."
              : "Ex.: funciona, mas o relatório não traz a coluna CPF_RESP."
          }
          className="min-h-28"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && valido) fechar(texto.trim());
          }}
        />
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => fechar(null)}>
            Cancelar
          </Button>
          <Button disabled={!valido} onClick={() => fechar(texto.trim())}>
            Marcar como {rotulo.toLowerCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { pedir, gravar, dialogo };
}
