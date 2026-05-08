export type Role = "gestor" | "analista";

export interface UsuarioRow {
  user_id: string;
  email: string | null;
  nome: string | null;
  avatar_url: string | null;
  cargo: string | null;
  colaborador_id: string | null;
  role: Role | null;
  must_change_password: boolean;
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
}

export interface TempPasswordInfo {
  email: string;
  password: string;
  context: "create" | "reset";
}
