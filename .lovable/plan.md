## Objetivo
Permitir que o usuário personalize o prompt usado pela IA que analisa as transcrições de reuniões (hoje fixo em `supabase/functions/analisar-transcricao/index.ts`).

## Como funciona hoje
- A edge function `analisar-transcricao` tem um `systemPrompt` hardcoded ("Você é um analista de reuniões...") e uma tool fixa que extrai resumo, pauta, próximos passos, decisões e participantes.
- Não há nenhum campo no banco nem na UI para customizar esse prompt.

## Mudanças propostas

### 1. Banco de dados
Criar tabela `ia_prompt_config` (singleton por organização/global) com:
- `chave` (ex: `analise_reuniao`) — identifica qual fluxo de IA
- `prompt_sistema` (text) — instruções principais
- `instrucoes_extras` (text, opcional) — contexto da empresa, glossário, tom etc.
- `ativo` (bool)
- RLS: leitura para usuários autenticados, escrita apenas para `admin`/`gestor` (via `has_role`).

Seed inicial com o prompt atual para não quebrar nada.

### 2. Edge function `analisar-transcricao`
- Antes de chamar a IA, buscar a linha `chave = 'analise_reuniao'` ativa.
- Compor o `systemPrompt` final: `prompt_sistema` + (se houver) `\n\nContexto adicional:\n${instrucoes_extras}`.
- Fallback para o prompt atual caso a tabela esteja vazia.

### 3. UI de configuração
Adicionar uma nova aba **"IA"** em `/configuracoes` (visível só para admin/gestor) com:
- Textarea grande para o prompt do sistema
- Textarea para instruções extras (ex: "Somos uma agência de marketing, foque em métricas de campanha")
- Botão **Restaurar padrão** (recarrega o prompt original)
- Botão **Salvar**
- Pequena descrição explicando que essas instruções afetam o resumo, pauta, decisões e próximos passos gerados após enviar um áudio.

## Pontos abertos

1. **Escopo do prompt**: por enquanto cobrir apenas a análise de reuniões (`analisar-transcricao`). Quer também já preparar para outras IAs do app (ex: `gerar-relatorio-reuniao`, `gerar-resumo-semanal`, `busca-natural`) usando a mesma tabela com `chave` diferente? Posso fazer só a de reuniões agora e deixar a estrutura pronta para expandir.

2. **Quem pode editar**: somente `admin`, ou `admin` + `gestor`?

3. **Prompt único ou por usuário**: prompt global da empresa (recomendado, mais simples) ou cada usuário pode ter o seu?

Posso seguir com: **só reuniões, editável por admin, prompt global** — confirma?
