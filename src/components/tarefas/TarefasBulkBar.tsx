import { Trash2, X, ChevronDown, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WORKFLOW, STATUS_LABEL, PRIO } from "@/components/tarefas/lib/workflow";

interface Props {
  count: number;
  onBulkStatus: (status: string) => void;
  onBulkPriority: (prio: string) => void;
  onBulkEmTeste: (value: boolean) => void;
  onBulkDelete: () => void;
  onClear: () => void;
}

export function TarefasBulkBar({ count, onBulkStatus, onBulkPriority, onBulkEmTeste, onBulkDelete, onClear }: Props) {
  return (
    <Card className="mb-3 flex flex-wrap items-center gap-2 border-primary/40 bg-primary/5 p-2">
      <span className="ml-2 text-sm font-medium">{count} selecionada(s)</span>
      <div className="flex flex-wrap gap-1.5 sm:ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              Mudar status <ChevronDown className="ml-1 h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Definir status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {WORKFLOW.map((s) => (
              <DropdownMenuItem key={s} onClick={() => onBulkStatus(s)}>
                {STATUS_LABEL[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              Prioridade <ChevronDown className="ml-1 h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {PRIO.map((p) => (
              <DropdownMenuItem key={p} onClick={() => onBulkPriority(p)} className="capitalize">
                {p}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" variant="outline" onClick={onBulkDelete} className="text-destructive">
          <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  );
}
