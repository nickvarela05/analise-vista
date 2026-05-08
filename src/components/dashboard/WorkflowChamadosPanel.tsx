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
      title="Workflow de chamados e tarefas"
      actions={
        <Link to="/relatorios" className="text-xs font-medium text-primary hover:underline">
          Ver relatórios →
        </Link>
      }
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Chamados externos (clientes)
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <WorkflowStep
          icon={Inbox}
          label="Recebidos"
          value={chamados.filter((c) => c.status === "aberto").length}
          tone="warning"
          to="/relatorios"
        />
        <WorkflowStep
          icon={ArrowRight}
          label="Em atendimento"
          value={chamadosEncaminhados}
          tone="info"
          to="/relatorios"
        />
        <WorkflowStep
          icon={CheckSquare}
          label="Resolvidos"
          value={chamados.filter((c) => c.status === "finalizado").length}
          tone="success"
          to="/relatorios"
        />
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Tarefas internas — etapas do desenvolvimento
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <WorkflowStep icon={Inbox} label="A fazer" value={tAberta} tone="warning" to="/tarefas" />
          <WorkflowStep
            icon={Wrench}
            label="Em desenvolvimento"
            value={tDesenv}
            tone="primary"
            to="/tarefas"
          />
          <WorkflowStep
            icon={CheckSquare}
            label="Em homologação"
            value={tHomolog}
            tone="info"
            to="/tarefas"
          />
          <WorkflowStep
            icon={ShieldCheck}
            label="Aprovadas"
            value={tAprovado}
            tone="success"
            to="/tarefas"
          />
          <WorkflowStep
            icon={XCircle}
            label="Com ajustes"
            value={tReprovado}
            tone="warning"
            to="/tarefas"
          />
          <WorkflowStep
            icon={Rocket}
            label="Em produção"
            value={tProducao}
            tone="success"
            to="/tarefas"
          />
        </div>
      </div>
    </Panel>
  );
}
