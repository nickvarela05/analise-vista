import * as React from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import type { Colaborador } from "./lib/types";
import { useUsuariosAdmin } from "./usuarios/useUsuariosAdmin";
import { UsuariosTable } from "./usuarios/UsuariosTable";
import { CriarUsuarioDialog } from "./usuarios/CriarUsuarioDialog";
import { ConvidarUsuarioDialog } from "./usuarios/ConvidarUsuarioDialog";
import { TempPasswordDialog } from "./usuarios/TempPasswordDialog";

interface Props {
  colabs: Colaborador[];
}

export function EquipeUsuariosView({ colabs }: Props) {
  const { user } = useAuth();
  const {
    usuarios,
    isLoading,
    error,
    busyId,
    tempPasswordInfo,
    setTempPasswordInfo,
    reload,
    resetarSenha,
    alterarRole,
    vincular,
    remover,
  } = useUsuariosAdmin();

  const colabName = React.useMemo(() => {
    const m = new Map<string, string>();
    colabs.forEach((c) => m.set(c.id, c.nome));
    return m;
  }, [colabs]);

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Falha ao carregar usuários: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {usuarios.length} usuário{usuarios.length === 1 ? "" : "s"} cadastrado
          {usuarios.length === 1 ? "" : "s"}.
        </p>
        <div className="flex items-center gap-2">
          <ConvidarUsuarioDialog />
          <CriarUsuarioDialog
            colabs={colabs}
            onCreated={(info) => {
              setTempPasswordInfo(info);
              reload();
            }}
          />
        </div>
      </div>

      <UsuariosTable
        usuarios={usuarios}
        colabs={colabs}
        colabName={colabName}
        meId={user?.id}
        busyId={busyId}
        onChangeRole={alterarRole}
        onVincular={vincular}
        onResetarSenha={resetarSenha}
        onRemover={remover}
      />

      <TempPasswordDialog info={tempPasswordInfo} onClose={() => setTempPasswordInfo(null)} />
    </div>
  );
}
