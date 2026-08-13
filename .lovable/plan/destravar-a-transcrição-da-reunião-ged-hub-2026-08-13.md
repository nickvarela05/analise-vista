# Destravar a transcrição da reunião GED/HUB

## O que eu verifiquei

Na base, a reunião "Reunião de alinhamento GED/HUB" está assim:

- status: `processando`
- progresso: parte **9 de 17**
- mensagem: "Transcrevendo… parte 9 de 17"
- rodadas automáticas registradas: **0**
- última atualização: hoje, 15:00

Ou seja: ela avançou (de 3 para 9 partes), mas o processo em segundo plano
foi encerrado no meio do caminho **sem gravar erro**. Como o status continua
`processando` e nada mais escreve na linha, a tela mostra "em andamento"
indefinidamente — não existe hoje nenhum mecanismo que perceba que o
processamento morreu.

Causa provável (a confirmar no primeiro passo): cada rodada do processamento
tem orçamento de 20 minutos e ainda dorme dentro do próprio processo enquanto
espera a cota do serviço de transcrição liberar. O ambiente de execução
encerra o trabalho em segundo plano bem antes disso, então o contador de
rodadas nunca é incrementado e a retomada automática nunca chega a acontecer.

## O que fazer

### 1. Confirmar a causa
Reprocessar a reunião a partir da parte 9 observando os logs de execução até
o encerramento, para registrar exatamente em que ponto e por que o trabalho é
interrompido.

### 2. Trocar "esperar dentro do processo" por "reencadear"
Em vez de uma rodada longa que dorme, cada execução passa a:
- trabalhar por uma janela curta (alguns minutos),
- salvar o progresso parcial,
- marcar a reunião como `pausado` com a parte atual,
- disparar uma nova execução para continuar de onde parou.

Assim nenhuma execução isolada é longa o bastante para ser encerrada pelo
ambiente, e a corrente segue sozinha até a última parte.

### 3. Vigia automático (anti-travamento)
Uma verificação periódica procura reuniões em `processando` ou `pausado` sem
nenhuma atualização há mais de ~10 minutos e retoma automaticamente da última
parte concluída, com um teto de tentativas para evitar laço infinito. Se o
teto for atingido, a reunião vira `erro` com mensagem clara — nunca mais fica
presa em "em andamento".

### 4. Tela de reuniões
- Mostrar "última atualização há X min" junto do progresso.
- Quando passar do tempo esperado sem avanço, indicar "retomando
  automaticamente" em vez de "processando".
- Manter o botão "Retomar transcrição" sempre disponível nesses casos.

### 5. Destravar agora
Colocar a reunião GED/HUB em `pausado` na parte 9 de 17 e disparar a
retomada, aproveitando as 9 partes já transcritas (nada é refeito).

## Detalhes técnicos

- `supabase/functions/transcrever-reuniao/index.ts`: reduzir
  `PIPELINE_TIMEOUT_MS` para uma janela curta; remover o `sleep` longo entre
  rodadas; ao pausar, gravar `transcricao_status = 'pausado'`,
  `transcricao_partes_feitas` e incrementar `transcricao_rodadas`, e então
  auto-invocar a função com `retomar: true`.
- Novo endpoint de vigia em `src/routes/api/public/hooks/` (validação por
  segredo no header) chamado por agendamento, que consulta reuniões paradas e
  reinvoca a transcrição.
- Migração apenas para o agendamento; nenhum campo novo é necessário.
- `src/routes/reunioes.tsx`: exibir tempo desde a última atualização e o
  estado "retomando automaticamente".
