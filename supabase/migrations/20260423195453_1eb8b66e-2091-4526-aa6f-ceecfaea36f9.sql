
-- Ana=e718a12e, Carlos=5268f05e, Juliana=e7ce3396, Mariana=5296ff4d, Rafael=9a503e41

UPDATE demanda SET
  responsaveis_ids = ARRAY['9a503e41-7ca3-4bc7-8b99-37711fb7a205'::uuid, 'e7ce3396-e7b2-44a9-b616-ccb2eb81e5c0'::uuid],
  solicitante = 'Diretoria Financeira',
  categoria = 'bug', origem = 'chamado',
  descricao = 'Cliente reportou divergência de centavos em parcelamentos longos. Necessário revisar arredondamento e fórmula.',
  tags = ARRAY['financeiro','urgente','calculo']
WHERE id = '47bf2a0a-0051-44c2-b460-c83999b6d6a5';

UPDATE demanda SET
  responsaveis_ids = ARRAY['5296ff4d-4d16-4591-9f16-07aaa4adf52e'::uuid],
  solicitante = 'Produto', categoria = 'nova_funcionalidade', origem = 'reuniao',
  descricao = 'Desenhar fluxo de boas-vindas para novos clientes B2B com checklist e tour guiado.',
  tags = ARRAY['onboarding','ux','produto']
WHERE id = '1b949fbc-4e78-49fc-b3a2-c99fcc8b3ced';

UPDATE demanda SET
  responsaveis_ids = ARRAY['5268f05e-fc03-409b-a5b5-8277fd3ec961'::uuid, 'e718a12e-6c05-4e85-892c-53005a7004e9'::uuid],
  solicitante = 'Equipe BI', categoria = 'bug', origem = 'email',
  descricao = 'Filtros combinados de período + status retornam linhas duplicadas no relatório consolidado.',
  tags = ARRAY['relatorios','bug']
WHERE id = '5713cb23-0ca5-4dba-a41d-5dcfe5549dbf';

UPDATE demanda SET
  responsaveis_ids = ARRAY['9a503e41-7ca3-4bc7-8b99-37711fb7a205'::uuid],
  solicitante = 'Cliente Acme S/A', categoria = 'nova_funcionalidade', origem = 'chamado',
  descricao = 'Integrar emissão automática via SEFAZ com retry e fila de contingência.',
  tags = ARRAY['integracao','fiscal','nfe']
WHERE id = '8b9fe69a-5710-418b-a6fe-bca1700d0a7f';

UPDATE demanda SET
  responsaveis_ids = ARRAY['e7ce3396-e7b2-44a9-b616-ccb2eb81e5c0'::uuid],
  solicitante = 'RH', categoria = 'duvida', origem = 'whatsapp',
  descricao = 'Esclarecer regra de comissão escalonada para vendedores juniores.',
  tags = ARRAY['comissoes','rh']
WHERE id = '17d4915b-20bb-4588-9f67-54c86e7ef11d';

UPDATE demanda SET
  responsaveis_ids = ARRAY['5296ff4d-4d16-4591-9f16-07aaa4adf52e'::uuid, 'e718a12e-6c05-4e85-892c-53005a7004e9'::uuid],
  solicitante = 'Produto', categoria = 'melhoria', origem = 'reuniao',
  descricao = 'Reduzir abandono no checkout — simplificar passos, validar dados em tempo real.',
  tags = ARRAY['ux','checkout','conversao']
WHERE id = '52987868-cee2-4991-b584-c5838c261d3b';

UPDATE demanda SET
  responsaveis_ids = ARRAY['5268f05e-fc03-409b-a5b5-8277fd3ec961'::uuid],
  solicitante = 'TI Corporativa', categoria = 'nova_funcionalidade', origem = 'email',
  descricao = 'Login único corporativo via Azure AD com mapeamento de grupos para perfis.',
  tags = ARRAY['auth','sso','azure']
WHERE id = '72776d79-7f53-493c-af20-871c507f6f73';

UPDATE demanda SET
  responsaveis_ids = ARRAY['e718a12e-6c05-4e85-892c-53005a7004e9'::uuid],
  solicitante = 'Tech Lead', categoria = 'documentacao', origem = 'outro',
  descricao = 'Publicar documentação OpenAPI 3.1 dos endpoints de pagamento e webhooks.',
  tags = ARRAY['docs','api']
WHERE id = 'c247db40-9555-4be3-9675-b966bed9a7d1';

UPDATE demanda SET
  responsaveis_ids = ARRAY['9a503e41-7ca3-4bc7-8b99-37711fb7a205'::uuid, '5268f05e-fc03-409b-a5b5-8277fd3ec961'::uuid],
  solicitante = 'Operações', categoria = 'melhoria', origem = 'chamado',
  descricao = 'Consulta de saldo em armazéns está acima de 3s — reduzir para <500ms com índices e cache.',
  tags = ARRAY['performance','estoque']
WHERE id = 'bad8e406-d820-4d81-a14d-5dc85e66b63c';

UPDATE demanda SET
  responsaveis_ids = ARRAY['e7ce3396-e7b2-44a9-b616-ccb2eb81e5c0'::uuid],
  solicitante = 'Cliente Beta Corp', categoria = 'duvida', origem = 'whatsapp',
  descricao = 'Cliente questionou hierarquia de aprovadores. Validar fluxo atual e responder.',
  tags = ARRAY['suporte','despesas']
WHERE id = '59b98499-b885-4291-b09d-c376477b22e3';

UPDATE demanda SET
  responsaveis_ids = ARRAY['9a503e41-7ca3-4bc7-8b99-37711fb7a205'::uuid, 'e7ce3396-e7b2-44a9-b616-ccb2eb81e5c0'::uuid, '5268f05e-fc03-409b-a5b5-8277fd3ec961'::uuid],
  equipe_toda = true,
  solicitante = 'Banco Central', categoria = 'nova_funcionalidade', origem = 'reuniao',
  descricao = 'Habilitar PIX como método de cobrança com QR Code dinâmico e conciliação automática.',
  tags = ARRAY['pix','pagamentos','integracao']
WHERE id = '494586cc-21ec-429d-aa2f-e6233a11362b';

UPDATE demanda SET
  responsaveis_ids = ARRAY['e718a12e-6c05-4e85-892c-53005a7004e9'::uuid],
  solicitante = 'Tech Writers', categoria = 'documentacao', origem = 'outro',
  descricao = 'Documentar todos os endpoints v2, exemplos cURL e códigos de erro.',
  tags = ARRAY['docs','api','v2']
WHERE id = '3a327efd-cf12-4180-b03e-43e99e63d5e4';

UPDATE demanda SET
  responsaveis_ids = ARRAY['9a503e41-7ca3-4bc7-8b99-37711fb7a205'::uuid],
  solicitante = 'Cliente Acme S/A', categoria = 'bug', origem = 'chamado',
  descricao = 'Cálculo retornando valor negativo em períodos > 24 meses. Verificar precisão decimal.',
  tags = ARRAY['critico','calculo','financeiro']
WHERE id = 'dcc38847-7349-4206-9ac7-0694ead5c626';

UPDATE demanda SET
  responsaveis_ids = ARRAY['5268f05e-fc03-409b-a5b5-8277fd3ec961'::uuid, '9a503e41-7ca3-4bc7-8b99-37711fb7a205'::uuid],
  solicitante = 'Diretoria Comercial', categoria = 'melhoria', origem = 'reuniao',
  descricao = 'Reescrever cálculo legado, separar regras por contrato e adicionar testes unitários.',
  tags = ARRAY['refatoracao','comissoes']
WHERE id = '8c6f42ee-1bc7-4b6d-a800-ed20a16170d5';

UPDATE demanda SET
  responsaveis_ids = ARRAY['5296ff4d-4d16-4591-9f16-07aaa4adf52e'::uuid, 'e718a12e-6c05-4e85-892c-53005a7004e9'::uuid],
  solicitante = 'CEO', categoria = 'nova_funcionalidade', origem = 'reuniao',
  descricao = 'Dashboard executivo com KPIs de receita, churn e NPS atualizados em tempo real.',
  tags = ARRAY['dashboard','kpi','executivo']
WHERE id = '42258f43-9944-4b4d-84b2-2ad631f661fa';
