# Migrações arquivadas

Estas 101 migrações montaram o banco até 27/10/2026. Foram substituídas por
`supabase/migrations/20261027180000_base.sql` (fase E3 do plano de limpeza), que tem o schema
inteiro tirado do banco de produção. Ficam aqui só como histórico: nada as aplica.

Até 27/10 o banco registrava só 17 delas em `supabase_migrations.schema_migrations`, e uma tinha
número diferente do arquivo (`20261001200000_receber_pacote_homologacao.sql` foi registrada como
`20261003185911`). Nessa data o histórico foi trocado por uma única linha, a da migração base.

Versões que estavam registradas:
20261003185911 receber_pacote_homologacao, 20261008193436 historico_status_automatico,
20261008220733 liberacao_producao_estrutura, 20261008221837 liberacao_producao_regra,
20261013141211 fase2_estrutura, 20261013143415 fase2_notificacao_por_pacote,
20261014024126 remove_auto_encerrar_tarefas_antigas, 20261014025031 agenda_limpeza_audios,
20261014125633 etapa1_rotina_e_historico_responsaveis, 20261014130400 etapa1_permissoes_equipe,
20261015190552 google_oauth_conta, 20261016140601 cron_sync_google_agenda,
20261023192734 get_tarefa_counts_rapido, 20261026171058 limpeza_fase_b_estrutura,
20261026171120 limpeza_fase_b_dados_auditoria, 20261026180936 remover_chamado_externo,
20261026181803 desempenho_rls_indices.
