
# Sistema de Gestão Interna — MVP (Núcleo Essencial)

Sistema web em PT-BR para a equipe de Análise de Requisitos, com tema claro/escuro alternável, sidebar à esquerda e header superior. Foco no núcleo agora; demais módulos entram em fase 2.

## Stack
- **Frontend**: React + Tailwind + shadcn/ui (TanStack Start / TanStack Router)
- **Backend**: Lovable Cloud (Supabase — Postgres + Auth + Storage)
- **Camada server**: `createServerFn` para escritas sensíveis e endpoints prontos para n8n

## Autenticação & Permissões
- Login por e-mail/senha (Supabase Auth)
- Tabela `user_roles` separada com enum `app_role` (`gestor`, `analista`)
- Função `has_role()` (SECURITY DEFINER) usada em todas as policies de RLS
- **Gestor**: CRUD total, gerencia avisos, colaboradores, atribui responsáveis
- **Analista**: vê dashboards, cria/edita suas próprias tarefas, registra reuniões e atualiza status do que lhe pertence

## Layout Geral
- Sidebar colapsável (lucide icons): Dashboard, Demandas, Tarefas, Reuniões, Avisos, Portfólio, Configurações
- Header: busca global, alternador de tema (claro/escuro), avatar/menu do usuário
- Página de Login separada; rotas protegidas via `_authenticated` layout
- Toasts para feedback (sucesso/erro), modais de confirmação para ações destrutivas

## Módulos do MVP

### 1. Dashboard (tela exclusiva)
Cards e gráficos consolidados:
- Total de demandas por status e categoria (gráfico barras/pizza)
- Volume por analista e por período
- Reuniões realizadas no período por analista
- Card de **Avisos ativos** (destaque para críticos)
- Filtro de período: hoje / semana / mês / customizado
- Cards clicáveis → navegam para a lista filtrada correspondente

### 2. Demandas / Solicitações
- Tabela `demanda` completa conforme especificação (enums: origem, categoria, status, prioridade)
- Lista com filtros (status, categoria, responsável, origem, período), paginação, busca
- Quick actions: alterar status, atribuir responsável, abrir detalhe
- Formulário de criação/edição (modal ou drawer)
- **Endpoint REST público** `/api/demandas` (POST/PATCH) protegido por API key — pronto para o n8n inserir demandas a partir de e-mails classificados

### 3. Tarefas Semanais & Diárias
- Tabela `todo` conforme especificação
- Abas "Hoje" e "Semana", filtros por responsável e status
- Criação inline rápida, checkbox para concluir direto na lista
- Indicador de prioridade visual

### 4. Reuniões (com transcrição/resumo + upload de áudio)
- Tabela `reuniao` conforme especificação
- Lista com filtros (período, tipo, status)
- Formulário com campos amplos para transcrição, resumo, próximos passos
- **Upload de áudio** para bucket privado `reuniao-audios` no Supabase Storage; metadados (path, tamanho, mime) salvos na tabela — pronto para n8n consumir e transcrever
- Link para calendário (Outlook/Google) como URL

### 5. Avisos do Gestor
- Tabela `aviso_gestor` conforme especificação
- Gestor cria/edita/ativa/desativa; analistas só leitura
- Tipos: informativo / alerta / crítico (com cores distintas)
- Surface ativos no Dashboard

### 6. Portfólio da Equipe
- Tabela `colaborador` conforme especificação
- Grid de cards (foto, nome, cargo, bio)
- Upload de foto para bucket público `colaborador-fotos`
- Tela de admin (gestor) para CRUD

## Melhorias de UX incluídas (sem inflar escopo)
- Componentes reutilizáveis: `DataTable`, `StatusBadge`, `FilterBar`, `EmptyState`, `ConfirmDialog`
- Validação com Zod (cliente + servidor)
- Mensagens de erro/sucesso consistentes via toasts
- Paginação padrão (20/página) e exportação CSV nas listas principais (Demandas, Tarefas, Reuniões)
- Estado vazio amigável em todas as listas
- Loading skeletons nas tabelas e dashboard

## Modelagem do banco (MVP)
Tabelas criadas: `profiles`, `user_roles`, `demanda`, `todo`, `reuniao`, `aviso_gestor`, `colaborador`. Todas com RLS habilitada, policies usando `has_role()`, triggers `updated_at` e seed de roles para o primeiro usuário cadastrado virar gestor.

## Fora do MVP (fase 2 — já modelado para encaixar depois)
Jornada de copa, Tarefas em Homologação, Painel de Férias, Integrações n8n (tela de monitoramento). As tabelas serão adicionadas quando solicitado, sem impacto no que for entregue agora.

## Próximos passos após aprovação
1. Configurar Lovable Cloud + Auth
2. Criar schema, enums, RLS e buckets de Storage
3. Layout base (sidebar, header, theme toggle, login, rotas protegidas)
4. Implementar os 6 módulos do núcleo
5. Endpoint REST `/api/demandas` para n8n
6. Seed mínimo + revisão de segurança (RLS)
