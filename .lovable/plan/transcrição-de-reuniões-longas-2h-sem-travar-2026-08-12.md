# Transcrição de reuniões longas (2h+) sem travar

## Sim — a duração é a causa principal

Os registros do serviço mostram a recusa exata: o Groq não recusou por **tamanho do arquivo**, e sim por
**segundos de áudio por hora** (limite de 7.200 segundos = 2 horas de áudio por hora de uso).
A reunião GED/HUB tem 2h42 (~9.720 s), ou seja, sozinha já estoura a cota horária — por isso
**todas** as partes de 8 MB são recusadas, cada uma cai para o Gemini, e o Gemini com um bloco de 8 MB
em base64 é lento e frequentemente morre no meio. Resultado: horas em "processando" e nada concluído.

Situação atual: a reunião está de novo em `processando`, sem transcrição salva.

## O que será feito

1. **Partes menores e por tempo, não por peso**: cortar o áudio em blocos de ~10 minutos (~4 MB),
   o que cabe com folga tanto no Groq quanto no Gemini.
2. **Respeitar a cota do Groq**: quando a recusa for por cota horária (e não por tamanho), esperar o
   intervalo informado pelo próprio serviço e repetir a parte, em vez de descartar o Groq na hora.
   Só depois de novas tentativas a parte vai para o Gemini.
3. **Progresso salvo parte a parte**: cada trecho transcrito é gravado assim que fica pronto, com um
   indicador do tipo "parte 7 de 17". Se o processo cair, ele retoma de onde parou em vez de recomeçar
   do zero — e o usuário vê que está andando.
4. **Fim do estado travado**: se o processamento morrer ou passar do tempo máximo, a reunião passa a
   `erro` com a causa real, em vez de ficar eternamente em "processando".
5. **Reprocessar a reunião GED/HUB** com o novo fluxo e conferir o resultado ponta a ponta.

## Detalhes técnicos

- `supabase/functions/transcrever-reuniao/index.ts`:
  - `CHUNK_TARGET_BYTES` deixa de ser fixo em 8 MB: o corte passa a mirar ~10 min de áudio, calculado a
    partir do bitrate lido nos frames MP3 (o parser já extrai bitrate/sample rate), com teto de ~5 MB.
  - `transcribeWithGroq`: distinguir 413 por tamanho de 429/413 por cota (`ASPH`, `rate limit`), lendo
    `retry-after` / o tempo sugerido na mensagem; nova classe `GroqQuotaError` com retry (até 2 tentativas,
    espera limitada) antes de cair para o Gemini.
  - `transcribeChunked`: salvar transcrição parcial acumulada em `reuniao.transcricao` a cada parte e
    gravar `transcricao_status` = `processando` com o progresso (coluna existente de erro/status reaproveitada
    para a mensagem "parte N/M"); ao final, roda `analyzeWithAI` normalmente.
  - Envolver o pipeline em um limite de tempo global; ao estourar, gravar `erro` com o motivo.
- Sem mudança no limite de upload (segue 25 MB) e sem voltar a compressão no navegador.
- Depois do deploy, disparar novamente a transcrição de `bd82104d-5c0d-4ac4-84e2-d823604a49fd`.
