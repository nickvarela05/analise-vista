# Transcrição de áudios grandes sem erro de 25 MB

## O que está acontecendo

O arquivo enviado nessa reunião tem **19,45 MB** (o app aceita até 25 MB, então o upload passou).
O erro aparece depois, na etapa de transcrição: o serviço externo usado hoje (Groq Whisper) recusou o arquivo
com o código "conteúdo grande demais", e o nosso código traduz qualquer recusa desse tipo para a frase fixa
"Áudio maior que 25 MB". Ou seja: a mensagem está errada — o limite prático do serviço é menor que os 25 MB anunciados.

## O que será feito

1. **Rota alternativa por IA**: quando o serviço atual recusar o áudio por tamanho (ou falhar por limite),
   a transcrição é refeita automaticamente pelo Gemini via Lovable AI, que aceita arquivos maiores.
   O usuário não precisa fazer nada — o processamento continua sozinho e o resultado segue para a análise
   (resumo, pauta, próximos passos) como hoje.
2. **Mensagens honestas**: se ainda assim falhar, o erro mostrado passa a indicar o tamanho real do arquivo
   e a causa concreta, em vez da frase fixa de 25 MB.
3. **Registro do caminho usado**: a reunião guarda qual serviço transcreveu, para diagnóstico futuro.
4. **Reprocessar a reunião do GED/HUB** que ficou com status de erro, para validar na prática.

## Detalhes técnicos

- `supabase/functions/transcrever-reuniao/index.ts`:
  - extrair a transcrição em duas estratégias: `transcribeWithGroq` (atual) e nova `transcribeWithGemini`.
  - `transcribeWithGemini`: baixa o blob do storage, converte para base64 e chama
    `https://ai.gateway.lovable.dev/v1/chat/completions` com `google/gemini-2.5-flash` e bloco
    `input_audio` (`format` derivado do mime/extensão: mp3/m4a/wav/webm/ogg), pedindo transcrição
    literal em pt-BR com marcação de falantes quando possível. Sem timeouts artificiais.
  - orquestração: tenta Groq; em 413 (ou erro de tamanho/limite) cai para Gemini. Arquivos acima de
    ~18 MB vão direto para o Gemini, evitando uma chamada fadada a falhar.
  - mensagens de erro passam a incluir o tamanho real (`blob.size`) formatado.
- Não há mudança de limite de upload no app (segue 25 MB) nem volta a compressão no navegador.
- Após o deploy, disparar novamente a transcrição da reunião com status `erro` e conferir o resultado.
