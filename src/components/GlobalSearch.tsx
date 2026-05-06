import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, Loader2, Inbox, CheckSquare, Calendar } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const navigate = useNavigate();
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<{
    demandas: { id: string; titulo: string }[];
    tarefas: { id: string; titulo: string }[];
    reunioes: { id: string; titulo: string }[];
  }>({ demandas: [], tarefas: [], reunioes: [] });

  React.useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setResults({ demandas: [], tarefas: [], reunioes: [] });
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      const like = `%${term}%`;
      const [d, t, r] = await Promise.all([
        supabase.from("demanda").select("id, titulo").ilike("titulo", like).limit(5),
        supabase.from("todo").select("id, titulo").ilike("titulo", like).limit(5),
        supabase.from("reuniao").select("id, titulo").ilike("titulo", like).limit(5),
      ]);
      setResults({
        demandas: d.data ?? [],
        tarefas: t.data ?? [],
        reunioes: r.data ?? [],
      });
      setLoading(false);
    }, 250);
    return () => clearTimeout(handle);
  }, [q, open]);

  const go = (path: string) => {
    onOpenChange(false);
    setQ("");
    navigate({ to: path });
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar demandas, tarefas, reuniões..."
        value={q}
        onValueChange={setQ}
      />
      <CommandList>
        {loading && (
          <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
          </div>
        )}
        {!loading && q.trim().length >= 2 && (
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        )}
        {results.demandas.length > 0 && (
          <CommandGroup heading="Demandas">
            {results.demandas.map((it) => (
              <CommandItem key={it.id} value={`d-${it.id}-${it.titulo}`} onSelect={() => go("/demandas")}>
                <Inbox className="h-4 w-4" /> {it.titulo}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.tarefas.length > 0 && (
          <CommandGroup heading="Tarefas">
            {results.tarefas.map((it) => (
              <CommandItem key={it.id} value={`t-${it.id}-${it.titulo}`} onSelect={() => go("/tarefas")}>
                <CheckSquare className="h-4 w-4" /> {it.titulo}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.reunioes.length > 0 && (
          <CommandGroup heading="Reuniões">
            {results.reunioes.map((it) => (
              <CommandItem key={it.id} value={`r-${it.id}-${it.titulo}`} onSelect={() => go("/reunioes")}>
                <Calendar className="h-4 w-4" /> {it.titulo}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

export function useGlobalSearchHotkey(setOpen: (o: boolean) => void) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);
}

export { Search };
