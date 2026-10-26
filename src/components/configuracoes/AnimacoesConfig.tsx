import * as React from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  lerPreferenciaMovimento,
  salvarPreferenciaMovimento,
  sistemaPedeMenosMovimento,
  type PreferenciaMovimento,
} from "@/lib/movimento";

const OPCOES: { id: PreferenciaMovimento; rotulo: string }[] = [
  { id: "sistema", rotulo: "Seguir o sistema" },
  { id: "sempre", rotulo: "Sempre" },
  { id: "nunca", rotulo: "Desligar" },
];

/** Animações (contagem dos números, barras, transição de tela): escolha de cada pessoa. */
export function AnimacoesConfig() {
  const [escolha, setEscolha] = React.useState<PreferenciaMovimento>("sempre");
  const [sistemaPede, setSistemaPede] = React.useState(false);

  React.useEffect(() => {
    setEscolha(lerPreferenciaMovimento());
    setSistemaPede(sistemaPedeMenosMovimento());
  }, []);

  const escolher = (p: PreferenciaMovimento) => {
    setEscolha(p);
    salvarPreferenciaMovimento(p);
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl bg-primary/15 p-2.5 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Animações</p>
            <p className="text-xs text-muted-foreground">
              Contagem dos números, barras que crescem e transição entre telas.
            </p>
          </div>
          <div
            className="flex rounded-xl border bg-muted/40 p-1"
            role="radiogroup"
            aria-label="Animações"
          >
            {OPCOES.map(({ id, rotulo }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={escolha === id}
                onClick={() => escolher(id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm transition-colors",
                  escolha === id
                    ? "bg-background font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>
        {sistemaPede && escolha === "sistema" && (
          <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-xs text-foreground">
            O seu computador está pedindo menos movimento (efeitos de animação do Windows
            desligados), então, com "Seguir o sistema", as animações ficam desligadas.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
