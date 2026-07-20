import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listTarefasTool from "./tools/list-tarefas";
import createTarefaTool from "./tools/create-tarefa";
import updateTarefaStatusTool from "./tools/update-tarefa-status";
import listReunioesTool from "./tools/list-reunioes";
import listDemandasTool from "./tools/list-demandas";

// Direct Supabase issuer (never the .lovable.cloud proxy — RFC 8414 issuer mismatch).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "nexus-mcp",
  title: "Nexus — Gestão Interna",
  version: "0.1.0",
  instructions:
    "Ferramentas do Nexus (gestão interna): consultar e atualizar tarefas, listar reuniões, demandas e criar tarefas em nome do usuário autenticado. Todas as chamadas respeitam as regras de acesso (RLS) do usuário.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listTarefasTool,
    createTarefaTool,
    updateTarefaStatusTool,
    listReunioesTool,
    listDemandasTool,
  ],
});
