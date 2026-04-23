import * as React from "react";
import { Check, ChevronsUpDown, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface AssigneeOption {
  id: string;
  nome: string;
  cargo?: string | null;
}

interface AssigneeComboboxProps {
  options: AssigneeOption[];
  selectedIds: string[];
  equipeToda: boolean;
  onChange: (next: { selectedIds: string[]; equipeToda: boolean }) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function AssigneeCombobox({
  options,
  selectedIds,
  equipeToda,
  onChange,
  placeholder = "Atribuir a...",
  className,
  disabled,
}: AssigneeComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedOptions = options.filter((o) => selectedSet.has(o.id));

  const toggle = (id: string) => {
    const next = selectedSet.has(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    onChange({ selectedIds: next, equipeToda: false });
  };

  const toggleEquipeToda = () => {
    if (equipeToda) onChange({ selectedIds: [], equipeToda: false });
    else onChange({ selectedIds: [], equipeToda: true });
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ selectedIds: [], equipeToda: false });
  };

  const label = equipeToda
    ? "Equipe toda"
    : selectedOptions.length === 0
      ? placeholder
      : selectedOptions.length === 1
        ? selectedOptions[0].nome
        : `${selectedOptions.length} atribuídos`;

  const isEmpty = !equipeToda && selectedOptions.length === 0;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal",
              isEmpty && "text-muted-foreground",
            )}
          >
            <span className="flex items-center gap-2 truncate">
              {equipeToda && <Users className="h-3.5 w-3.5 text-primary" />}
              <span className="truncate">{label}</span>
            </span>
            <span className="flex items-center gap-1">
              {(equipeToda || selectedOptions.length > 0) && (
                <X
                  className="h-3.5 w-3.5 opacity-60 hover:opacity-100"
                  onClick={clear}
                />
              )}
              <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar colaborador..." />
            <CommandList>
              <CommandEmpty>Nenhum colaborador.</CommandEmpty>
              <CommandGroup>
                <CommandItem onSelect={toggleEquipeToda} value="__equipe-toda__">
                  <Users className="mr-2 h-4 w-4 text-primary" />
                  <span className="font-medium">Equipe toda</span>
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      equipeToda ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Colaboradores">
                {options.map((opt) => {
                  const checked = selectedSet.has(opt.id);
                  return (
                    <CommandItem
                      key={opt.id}
                      value={opt.nome}
                      onSelect={() => toggle(opt.id)}
                    >
                      <div className="flex flex-1 flex-col">
                        <span>{opt.nome}</span>
                        {opt.cargo && (
                          <span className="text-[10px] text-muted-foreground">
                            {opt.cargo}
                          </span>
                        )}
                      </div>
                      <Check
                        className={cn(
                          "ml-auto h-4 w-4",
                          checked ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {(equipeToda || selectedOptions.length > 0) && (
        <div className="flex flex-wrap gap-1">
          {equipeToda ? (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Users className="h-3 w-3" /> Equipe toda
            </Badge>
          ) : (
            selectedOptions.map((o) => (
              <Badge key={o.id} variant="secondary" className="gap-1 text-[10px]">
                {o.nome}
                <button
                  type="button"
                  onClick={() => toggle(o.id)}
                  className="ml-0.5 rounded-sm hover:bg-background/40"
                  aria-label={`Remover ${o.nome}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Render compact assignee badges for use inside table cells / cards.
 */
export function AssigneeBadges({
  selectedIds,
  equipeToda,
  options,
  max = 3,
}: {
  selectedIds: string[] | null | undefined;
  equipeToda: boolean | null | undefined;
  options: AssigneeOption[];
  max?: number;
}) {
  if (equipeToda) {
    return (
      <Badge variant="secondary" className="gap-1 text-[10px]">
        <Users className="h-3 w-3" /> Equipe toda
      </Badge>
    );
  }
  const ids = selectedIds ?? [];
  if (ids.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const map = new Map(options.map((o) => [o.id, o]));
  const shown = ids.slice(0, max);
  const extra = ids.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((id) => (
        <Badge key={id} variant="outline" className="text-[10px]">
          {map.get(id)?.nome ?? "—"}
        </Badge>
      ))}
      {extra > 0 && (
        <Badge variant="outline" className="text-[10px]">
          +{extra}
        </Badge>
      )}
    </div>
  );
}
