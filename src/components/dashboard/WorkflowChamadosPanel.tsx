import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckSquare,
  Inbox,
  Wrench,
  ShieldCheck,
  XCircle,
  Rocket,
} from "lucide-react";
import { Panel } from "@/components/KpiTile";
import { WorkflowStep } from "@/components/dashboard/WorkflowStep";
import type { ChamadoRow, TarefaRow } from "@/lib/db-types";

interface Props {
  chamados: ChamadoRow[];
  tarefas: TarefaRow[];
  chamadosEncaminhados: number;
}

export function WorkflowChamadosPanel({ chamados, tarefas, chamadosEncaminhados }: Props) {
  const count = (statuses: string[]) =>
    tarefas.filter((t) => statuses.includes(t.status as string)).length;

  const tAberta = count(["aberta", "pendente"]);
  const tDesenv = count(["em_andamento"]);
  const tHomolog = count(["homologacao", "encaminhada"]);
  const tAprovado = count(["aprovado", "aprovado_ressalvas"]);
  const tReprovado = count(["reprovado", "reprovada", "cancelada"]);
  const tProducao = count(["producao", "concluida"]);

  return (
    <Panel
      title="Workflow de chamados"
      actions={
        <Link to="/relatorios" className="text-xs font-medium text-primary hover:underline">
          Ver relatórios →
        </Link>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <WorkflowStep
          icon={Inbox}
          label="Aberto"
          value={chamados.filter((c) => c.status === "aberto").length}
          tone="warning"
          to="/relatorios"
        />
        <WorkflowStep
          icon={ArrowRight}
          label="Encaminhado"
          value={chamadosEncaminhados}
          tone="info"
          to="/relatorios"
        />
        <WorkflowStep
          icon={CheckSquare}
          label="Finalizado"
          value={chamados.filter((c) => c.status === "finalizado").length}
          tone="success"
          to="/relatorios"
        />
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Tarefas internas (workflow Sisteplan)
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <WorkflowStep icon={Inbox} label="Aberta" value={tAberta} tone="warning" to="/tarefas" />
          <WorkflowStep
            icon={Wrench}
            label="Em desenvolvimento"
            value={tDesenv}
            tone="primary"
            to="/tarefas"
          />
          <WorkflowStep
            icon={CheckSquare}
            label="Homologação"
            value={tHomolog}
            tone="info"
            to="/tarefas"
          />
          <WorkflowStep
            icon={ShieldCheck}
            label="Aprovado"
            value={tAprovado}
            tone="success"
            to="/tarefas"
          />
          <WorkflowStep
            icon={XCircle}
            label="Reprovado"
            value={tReprovado}
            tone="warning"
            to="/tarefas"
          />
          <WorkflowStep
            icon={Rocket}
            label="Produção"
            value={tProducao}
            tone="success"
            to="/tarefas"
          />
        </div>
      </div>
    </Panel>
  );
}
