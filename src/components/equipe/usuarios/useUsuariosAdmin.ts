import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminFetch } from "@/lib/admin-fetch";
import { qk } from "@/lib/queries/keys";
import type { Role, UsuarioRow, TempPasswordInfo } from "./types";

/**
 * Centraliza o estado e mutations da gestão de usuários admin.
 * Mantém a queryKey `qk.usuariosAdmin()` (`["usuarios-admin"]`) preservando invalidations existentes.
 */
export function useUsuariosAdmin() {
  const qc = useQueryClient();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [tempPasswordInfo, setTempPasswordInfo] = React.useState<TempPasswordInfo | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: qk.usuariosAdmin(),
    queryFn: async () => {
      const r = await adminFetch<{ usuarios: UsuarioRow[] }>("/api/admin/usuarios");
      return r.usuarios;
    },
  });

  const reload = React.useCallback(
    () => qc.invalidateQueries({ queryKey: qk.usuariosAdmin() }),
    [qc],
  );

  const withBusy = React.useCallback(
    async <T,>(userId: string, label: string, fn: () => Promise<T>): Promise<T | null> => {
      setBusyId(userId);
      try {
        return await fn();
      } catch (e) {
        toast.error(label, { description: (e as Error).message });
        return null;
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  const resetarSenha = React.useCallback(
    async (u: UsuarioRow) => {
      if (!u.email) return;
      if (
        !confirm(
          `Gerar nova senha temporária para ${u.email}? A senha atual deixará de funcionar.`,
        )
      )
        return;
      const r = await withBusy(u.user_id, "Erro", () =>
        adminFetch<{ ok: true; temp_password: string }>(
          "/api/admin/usuarios?action=reset-password",
          { method: "POST", body: JSON.stringify({ user_id: u.user_id }) },
        ),
      );
      if (r) {
        setTempPasswordInfo({ email: u.email!, password: r.temp_password, context: "reset" });
        reload();
      }
    },
    [reload, withBusy],
  );

  const alterarRole = React.useCallback(
    async (u: UsuarioRow, role: Role) => {
      if (u.role === role) return;
      const ok = await withBusy(u.user_id, "Erro", () =>
        adminFetch("/api/admin/usuarios?action=role", {
          method: "POST",
          body: JSON.stringify({ user_id: u.user_id, role }),
        }),
      );
      if (ok) {
        toast.success("Role atualizada");
        reload();
      }
    },
    [reload, withBusy],
  );

  const vincular = React.useCallback(
    async (u: UsuarioRow, colaborador_id: string | null) => {
      const ok = await withBusy(u.user_id, "Erro", () =>
        adminFetch("/api/admin/usuarios?action=link", {
          method: "POST",
          body: JSON.stringify({ user_id: u.user_id, colaborador_id }),
        }),
      );
      if (ok) {
        toast.success(colaborador_id ? "Vinculado" : "Desvinculado");
        reload();
      }
    },
    [reload, withBusy],
  );

  const remover = React.useCallback(
    async (u: UsuarioRow) => {
      if (!confirm(`Remover usuário ${u.email}? Esta ação não pode ser desfeita.`)) return;
      const ok = await withBusy(u.user_id, "Erro", () =>
        adminFetch("/api/admin/usuarios?action=delete", {
          method: "POST",
          body: JSON.stringify({ user_id: u.user_id }),
        }),
      );
      if (ok) {
        toast.success("Usuário removido");
        reload();
      }
    },
    [reload, withBusy],
  );

  return {
    usuarios: data ?? [],
    isLoading,
    error: error as Error | null,
    busyId,
    tempPasswordInfo,
    setTempPasswordInfo,
    reload,
    resetarSenha,
    alterarRole,
    vincular,
    remover,
  };
}
