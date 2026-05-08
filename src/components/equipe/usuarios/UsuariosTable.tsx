import { format } from "date-fns";
import { AlertTriangle, KeyRound, Loader2, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Colaborador } from "@/components/equipe/lib/types";
import type { Role, UsuarioRow } from "./types";

interface Props {
  usuarios: UsuarioRow[];
  colabs: Colaborador[];
  colabName: Map<string, string>;
  meId: string | undefined;
  busyId: string | null;
  onChangeRole: (u: UsuarioRow, role: Role) => void;
  onVincular: (u: UsuarioRow, colaboradorId: string | null) => void;
  onResetarSenha: (u: UsuarioRow) => void;
  onRemover: (u: UsuarioRow) => void;
}

export function UsuariosTable({
  usuarios,
  colabs,
  colabName,
  meId,
  busyId,
  onChangeRole,
  onVincular,
  onResetarSenha,
  onRemover,
}: Props) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuário</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Colaborador vinculado</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usuarios.map((u) => {
            const isMe = u.user_id === meId;
            const busy = busyId === u.user_id;
            return (
              <TableRow key={u.user_id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                      <AvatarFallback className="bg-primary/10 text-xs text-primary">
                        {(u.nome ?? u.email ?? "?").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="leading-tight">
                      <div className="text-sm font-medium">
                        {u.nome ?? "—"}
                        {isMe && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            você
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Select
                    value={u.role ?? undefined}
                    onValueChange={(v) => onChangeRole(u, v as Role)}
                    disabled={busy}
                  >
                    <SelectTrigger className="h-8 w-[130px]">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gestor">Gestor</SelectItem>
                      <SelectItem value="analista">Analista</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={u.colaborador_id ?? "__none__"}
                    onValueChange={(v) => onVincular(u, v === "__none__" ? null : v)}
                    disabled={busy}
                  >
                    <SelectTrigger className="h-8 w-[220px]">
                      <SelectValue placeholder="Sem vínculo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Sem vínculo —</SelectItem>
                      {colabs.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {u.colaborador_id && !colabName.has(u.colaborador_id) && (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Vinculado a colaborador inativo
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <div className="space-y-0.5 text-xs">
                    {u.must_change_password ? (
                      <Badge
                        variant="outline"
                        className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-400"
                      >
                        <AlertTriangle className="mr-1 h-3 w-3" /> Senha temporária
                      </Badge>
                    ) : u.last_sign_in_at ? (
                      <Badge variant="outline" className="text-[10px]">
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        Nunca acessou
                      </Badge>
                    )}
                    {u.last_sign_in_at && (
                      <div className="text-[10px] text-muted-foreground">
                        Último acesso: {format(new Date(u.last_sign_in_at), "dd/MM/yyyy HH:mm")}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => onResetarSenha(u)}
                      disabled={busy}
                      title="Gerar nova senha temporária"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => onRemover(u)}
                      disabled={busy || isMe}
                      title={isMe ? "Você não pode remover seu próprio usuário" : "Remover usuário"}
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {usuarios.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                Nenhum usuário cadastrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
