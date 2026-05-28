import * as React from "react";
import { AlertTriangle, Check, Copy, KeyRound, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogHero } from "@/components/shared/DialogHero";
import { DialogSection } from "@/components/shared/DialogSection";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TempPasswordInfo } from "./types";

export function TempPasswordDialog({
  info,
  onClose,
}: {
  info: TempPasswordInfo | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => {
    if (info) setCopied(false);
  }, [info]);

  if (!info) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(info.password);
      setCopied(true);
      toast.success("Senha copiada");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const title = info.context === "create" ? "Usuário criado" : "Senha redefinida";

  return (
    <Dialog open={!!info} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="px-6 pt-6">
          <DialogHero
            icon={KeyRound}
            tone="amber"
            eyebrow="Equipe · Acesso"
            title={title}
            description="Esta senha é temporária e aparece apenas uma vez. Copie e entregue ao usuário por canal seguro. No primeiro acesso ele será obrigado a definir uma nova senha."
          />
        </div>

        <div className="space-y-4 px-6 py-5">
          <DialogSection title="Credenciais" icon={KeyRound}>
            <div className="space-y-1.5">
              <Label className="text-xs">
                <Mail className="mr-1 inline h-3 w-3" />
                E-mail
              </Label>
              <Input value={info.email} readOnly />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Senha temporária</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={info.password}
                  readOnly
                  className="font-mono tracking-wider"
                />
                <Button type="button" variant="outline" size="icon" onClick={copy}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </DialogSection>

          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Anote ou copie agora — esta senha não poderá ser recuperada depois.
            </span>
          </div>

          <DialogFooter className="gap-2 border-t pt-3">
            <Button
              onClick={onClose}
              className="bg-amber-500 text-white hover:bg-amber-600"
            >
              Entendi
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
