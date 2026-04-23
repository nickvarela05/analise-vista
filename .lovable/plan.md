

## Gerar dump completo do banco

Vou exportar o banco PostgreSQL atual (schema + dados de todas as tabelas) e te entregar como um arquivo `.sql` pronto para restaurar no seu próprio projeto Supabase.

### O que será incluído no dump

- **Schema completo**: tabelas (`aviso_gestor`, `chamado_externo`, `colaborador`, `colaborador_ferias`, `colaborador_horario`, `demanda`, `profiles`, `reuniao`, `todo`, `user_roles`)
- **Tipos enum**: `app_role`, `aviso_tipo`, `chamado_externo_*`, `demanda_*`, `reuniao_*`, `todo_*`
- **Funções**: `has_role`, `handle_new_user`, `update_updated_at_column`
- **Políticas RLS** de todas as tabelas
- **Dados** (`INSERT`s) de todas as tabelas públicas
- **Buckets de Storage**: definições de `reuniao-audios` e `colaborador-fotos` (apenas a configuração — os arquivos binários precisam ser baixados separadamente do Storage; explico abaixo)

### O que NÃO entra no dump

- **Usuários do `auth.users`**: o schema `auth` é gerenciado pelo Supabase e não é portável entre projetos via dump SQL. No projeto novo, os usuários precisarão ser recriados (ou migrados via Admin API com export do `auth.users`).
- **Arquivos físicos do Storage**: o dump traz só a estrutura dos buckets. Para mover áudios de reuniões e fotos de colaboradores, vou gerar um script complementar que baixa os arquivos.

### Como vou gerar

1. Usar `pg_dump` contra a connection string `SUPABASE_DB_URL` (já disponível como secret), escopado ao schema `public` + buckets de storage.
2. Salvar o arquivo em `/mnt/documents/backup_completo.sql` para você baixar.
3. (Opcional) Gerar um segundo script `restore_instructions.md` com o passo-a-passo para restaurar no seu novo Supabase.
4. (Opcional) Gerar script Node `download_storage_files.ts` que baixa todos os arquivos dos buckets para uma pasta local.

### Detalhes técnicos

- Comando base: `pg_dump "$SUPABASE_DB_URL" --schema=public --no-owner --no-privileges --inserts -f /mnt/documents/backup_completo.sql`
- Flag `--inserts` em vez de `COPY` para máxima compatibilidade na restauração.
- Flag `--no-owner` e `--no-privileges` para evitar conflitos de roles entre projetos Supabase diferentes.
- Vou também gerar uma versão `backup_schema_only.sql` (sem dados) caso você queira só a estrutura.

### Entregáveis

```text
/mnt/documents/
├── backup_completo.sql        # schema + dados (principal)
├── backup_schema_only.sql     # só a estrutura
└── restore_instructions.md    # passo-a-passo de restauração
```

Após sua aprovação, executo o dump e te envio os arquivos como `<lov-artifact>` para download direto.

