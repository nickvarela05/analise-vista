import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckSquare, Inbox } from "lucide-react";
import { Panel } from "@/components/KpiTile";
import { WorkflowStep } from "@/components/dashboard/WorkflowStep";
import type { ChamadoRow, TarefaRow } from "@/lib/db-types";

interface Props {
  chamados: ChamadoRow[];
  tarefas: TarefaRow[];
  relatEncaminhados: number;
  taskHML: number;
  taskProd: number;
}

export function WorkflowChamadosPanel({ chamados, tarefas, relatEncaminhados, taskHML, taskProd }: Props) {
  return (
    <Panel
      title="Workflow de chamados"
      className="lg:col-span-2"
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
          value={relatEncaminhados}
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <WorkflowStep
            icon={Inbox}
            label="Abertura"
            value={tarefas.filter((t) => ["aberta", "pendente"].includes(t.status)).length}
            tone="warning"
            to="/tarefas"
          />
          <WorkflowStep
            icon={ArrowRight}
            label="Encaminhada"
            value={tarefas.filter((t) => t.status === "encaminhada").length}
            tone="info"
            to="/tarefas"
          />
          <WorkflowStep icon={CheckSquare} label="Homologação" value={taskHML} tone="primary" to="/tarefas" />
          <WorkflowStep icon={CheckSquare} label="Produção" value={taskProd} tone="success" to="/tarefas" />
          <WorkflowStep
            icon={CheckSquare}
            label="Concluída"
            value={tarefas.filter((t) => t.status === "concluida").length}
            tone="success"
            to="/tarefas"
          />
        </div>
      </div>
    </Panel>
  );
}
