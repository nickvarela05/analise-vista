import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ArrowRight, Calendar, FileBarChart, FlaskConical } from "lucide-react";
import { Panel } from "@/components/KpiTile";
import { Badge } from "@/components/ui/badge";
import type { ReuniaoRow, TarefaRow } from "@/lib/db-types";
import type { SolicitacaoRelatorio } from "@/lib/n8n-db.functions";
import { parseDateOnly } from "@/lib/date";

const MAX = 5;

function Bloco({
  icon: Icon,
  titulo,
  total,
  vazio,
  link,
  children,
}: {
  icon: typeof Calendar;
  titulo: string;
  total: number;
  vazio: string;
  link?: { to: "/tarefas" | "/relatorios" | "/reunioes"; rotulo: string };
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {titulo}
          <span className="tabular-nums text-foreground">{total}</span>
        </p>
        {link && total > MAX && (
          <Link
            to={link.to}
            className="flex items-center gap-0.5 text-[11px] text-primary hover:underline"
          >
            {link.rotulo} <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      {total === 0 ? (
        <p className="text-xs text-muted-foreground">{vazio}</p>
      ) : (
        <ul className="space-y-1">{children}</ul>
      )}
    </div>
  );
}

/** O que é meu hoje: testes da rodada, relatórios pendentes e reuniões do dia (modelo B, "Meu Dia"). */
export function MeuDiaPanel({
  vinculado,
  meusTestes,
  meusRelatorios,
  minhasReunioes,
  onOpen,
}: {
  /** Usuário tem colaborador vinculado (sem vínculo não há como saber o que é dele). */
  vinculado: boolean;
  meusTestes: TarefaRow[];
  meusRelatorios: SolicitacaoRelatorio[];
  minhasReunioes: ReuniaoRow[];
  onOpen: (t: TarefaRow) => void;
}) {
  if (!vinculado) {
    return (
      <Panel title="Meu dia">
        <p className="text-xs text-muted-foreground">
          Seu usuário não está vinculado a um colaborador, então não dá para saber o que é seu. Peça
          a um gestor para fazer o vínculo em Equipe.
        </p>
      </Panel>
    );
  }
  return (
    <Panel
      title="Meu dia"
      hint="O que está atribuído a você: testes da rodada, relatórios pendentes e reuniões de hoje."
    >
      <div className="space-y-4">
        <Bloco
          icon={FlaskConical}
          titulo="Para eu testar"
          total={meusTestes.length}
          vazio="Nenhum teste pendente com você."
          link={{ to: "/tarefas", rotulo: "Ver no Kanban" }}
        >
          {meusTestes.slice(0, MAX).map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onOpen(t)}
                className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-muted/50"
              >
                <span className="min-w-0 flex-1 truncate">{t.titulo}</span>
                {t.sistema && (
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {t.sistema}
                  </Badge>
                )}
              </button>
            </li>
          ))}
        </Bloco>

        <Bloco
          icon={FileBarChart}
          titulo="Meus relatórios pendentes"
          total={meusRelatorios.length}
          vazio="Nenhum relatório pendente com você."
          link={{ to: "/relatorios", rotulo: "Ver todos" }}
        >
          {meusRelatorios.slice(0, MAX).map((r) => {
            const prazo = parseDateOnly(r.prazo);
            return (
              <li key={r.id}>
                <Link
                  to="/relatorios"
                  className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted/50"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {r.descricao || r.tipo_base || "Relatório"}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {r.solicitante_nome}
                    {prazo && ` · até ${format(prazo, "dd/MM")}`}
                  </span>
                </Link>
              </li>
            );
          })}
        </Bloco>

        <Bloco
          icon={Calendar}
          titulo="Reuniões hoje"
          total={minhasReunioes.length}
          vazio="Nenhuma reunião hoje."
        >
          {minhasReunioes.slice(0, MAX).map((r) => (
            <li key={r.id}>
              <Link
                to="/reunioes"
                className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted/50"
              >
                <span className="shrink-0 tabular-nums text-xs font-semibold">
                  {format(new Date(r.data_reuniao), "HH:mm")}
                </span>
                <span className="min-w-0 flex-1 truncate">{r.titulo}</span>
              </Link>
            </li>
          ))}
        </Bloco>
      </div>
    </Panel>
  );
}
