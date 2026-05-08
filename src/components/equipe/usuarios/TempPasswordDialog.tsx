import * as React from "react";
import { AlertTriangle, Check, Copy } from "lucide-react";
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

  return (
    <Dialog open={!!info} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {info.context === "create" ? "Usuário criado" : "Senha redefinida"}
          </DialogTitle>
          <DialogDescription>
            Esta senha é temporária e <strong>aparece apenas uma vez</strong>. Copie e entregue ao
            usuário em um canal seguro. No primeiro acesso ele será obrigado a definir uma nova
            senha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">E-mail</Label>
            <Input value={info.email} readOnly />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Senha temporária</Label>
            <div className="flex items-center gap-2">
              <Input value={info.password} readOnly className="font-mono tracking-wider" />
              <Button type="button" variant="outline" size="icon" onClick={copy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
            Anote ou copie agora — esta senha não poderá ser recuperada depois.
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
