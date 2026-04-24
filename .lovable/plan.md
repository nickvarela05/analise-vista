## Objetivo

Substituir o ElevenLabs (Free Tier bloqueado por "atividade incomum") pelo **Groq Whisper-large-v3**: gratuito, rápido, sem cartão, sem bloqueio de IP de servidor. Manter o código antigo do ElevenLabs comentado para rollback fácil.

## Pré-requisito (você precisa fazer antes)

1. Acesse **https://console.groq.com**
2. Crie conta gratuita (login com Google funciona)
3. Vá em **API Keys** → **Create API Key**
4. Copie a chave (começa com `gsk_...`)

Depois que eu começar a implementação, vou pedir essa chave via tool de secret (`GROQ_API_KEY`).

## O que muda

### 1. Edge function `supabase/functions/transcrever-reuniao/index.ts`
- Adicionar função `transcribeWithGroq(audioBlob, fileName)` que chama:
  ```
  POST https://api.groq.com/openai/v1/audio/transcriptions
  model=whisper-large-v3
  language=pt
  response_format=verbose_json
  temperature=0
  ```
- Comentar (não apagar) a função `transcribeWithElevenLabs` e o check da `ELEVENLABS_API_KEY`, com cabeçalho explicando o motivo, para rollback rápido se quisermos voltar.
- Trocar a chamada no handler para usar Groq.
- Tratamento de erros específicos:
  - 401 → "Groq API key inválida"
  - 413 → "Áudio maior que 25 MB. Comprima ou divida o arquivo."
  - 429 → "Limite de requisições Groq atingido, aguarde 1 min."

### 2. Sem mudanças em
- Frontend (mesma chamada à edge function)
- Banco de dados (mesmos campos)
- Análise por IA com Gemini (continua extraindo resumo, pauta, próximos passos, decisões e participantes a partir do texto)

## Limitações a saber

- **Máximo 25 MB por arquivo**. Reuniões de 1h em MP3 mono 32–64 kbps cabem (~14–28 MB). Se o áudio atual for WAV ou bitrate alto e estourar, te aviso e adiciono compressão depois.
- **Sem diarização** (texto corrido, sem "Falante 1/2"). Confirmado que está OK pra você. O Gemini ainda detecta nomes mencionados.

## Passos da implementação (após sua aprovação)

1. Pedir o secret `GROQ_API_KEY` via tool.
2. Editar `supabase/functions/transcrever-reuniao/index.ts` (adicionar Groq, comentar ElevenLabs).
3. Deploy automático.
4. Você clica em **Tentar novamente** no card da reunião com erro e validamos.

Pode confirmar e me dizer quando tiver a `GROQ_API_KEY` em mãos?