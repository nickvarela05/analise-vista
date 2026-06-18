# Compressor automático de áudio no upload de reunião

## Resposta curta
Sim, dá pra fazer — e o melhor lugar é **no navegador, antes do upload**, usando `ffmpeg.wasm`. Assim o arquivo já sobe pequeno (economiza banda do usuário, storage do Lovable Cloud e fica dentro do limite da API de transcrição), sem precisar de servidor de processamento.

## Por que no navegador (e não no servidor)
- O runtime serverless onde rodam as edge functions **não suporta ffmpeg nativo** nem `sharp`/binários — não dá pra comprimir lá depois do upload.
- Fazer o upload de 500MB só pra rejeitar/comprimir desperdiça banda do usuário (muitas vezes em rede da prefeitura).
- `ffmpeg.wasm` roda 100% client-side, sem custo de infra.

## O que vai ser feito

### 1. Detecção e compressão automática
Quando o usuário seleciona um arquivo em `UploadAudioReuniao.tsx`:

- **Se for áudio puro pequeno (< 20 MB)** → sobe direto, sem mexer (não vale o custo de processar).
- **Se for MP4/vídeo OU áudio > 20 MB** → comprime automaticamente antes do upload:
  - Extrai apenas a faixa de áudio (descarta vídeo se for MP4)
  - Reencoda para **Opus 24 kbps mono 16 kHz** em container `.ogg`
  - Resultado típico: 1h de reunião ≈ 10–12 MB (vs. 500MB+ de vídeo MP4)
  - 16 kHz mono é o formato ideal pra voz e o que a maioria dos modelos de STT (Whisper, Gemini, etc.) usa internamente — não há perda de qualidade de transcrição.

### 2. UI durante a compressão
Novo estado entre "selecionar" e "enviando":
- Barra de progresso "🎛️ Otimizando áudio… (X%)" usando os callbacks de progresso do ffmpeg.
- Mostra o tamanho original → tamanho final ("482 MB → 11 MB") quando termina.
- Botão "Cancelar" interrompe a operação.

### 3. Fallback seguro
Se `ffmpeg.wasm` falhar (navegador antigo sem SharedArrayBuffer, memória insuficiente, etc.):
- Mostra aviso amigável e tenta subir o arquivo original.
- Se ultrapassar o limite (eleva o teto atual de 100 MB para o que a API de transcrição aceitar), aí sim bloqueia com mensagem clara.

### 4. Aumentar o `MAX_BYTES`
O limite atual é 100 MB. Como qualquer arquivo grande agora será comprimido antes, posso elevar o teto de **entrada** para 1 GB (ou o que você preferir) — o que chega no storage continua pequeno.

## Detalhes técnicos

- Pacote: `@ffmpeg/ffmpeg` + `@ffmpeg/util` (build oficial, ~25 MB de wasm, carregado **sob demanda** via `import()` dinâmico — não pesa no bundle inicial).
- Requer headers COOP/COEP pra habilitar `SharedArrayBuffer`. Em dev (Vite) e em produção (Cloudflare Worker do Lovable), adicionar:
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: require-corp`
  - Isso pode quebrar `<iframe>`/imagens externas sem CORP. Verifico se há algum recurso externo no app antes de aplicar; se houver, uso a versão `mt` (single-thread) do ffmpeg.wasm, que não exige esses headers (compressão fica ~2x mais lenta mas funciona).
- Comando ffmpeg equivalente: `ffmpeg -i input.mp4 -vn -ac 1 -ar 16000 -c:a libopus -b:a 24k output.ogg`
- Arquivos afetados:
  - `src/components/reunioes/UploadAudioReuniao.tsx` — fluxo de compressão, novos estados de UI, mudança de `MAX_BYTES`.
  - `src/lib/audio-compress.ts` (novo) — wrapper isolado do ffmpeg.wasm com `import()` dinâmico e callback de progresso.
  - `vite.config.ts` — headers COOP/COEP no dev server (se formos pela versão multi-thread).
  - `package.json` — adicionar `@ffmpeg/ffmpeg` e `@ffmpeg/util`.

## O que confirmar com você antes de implementar

1. **Qual a API de transcrição em uso hoje** (edge function `transcrever-reuniao`)? Saber o limite real (ex.: Whisper = 25 MB, Gemini = 20 MB inline / 2 GB via Files API) define o bitrate-alvo da compressão.
2. **OK em aumentar `MAX_BYTES` de 100 MB para ~1 GB de entrada?** O que sobe pro storage continua pequeno (10–15 MB).
3. **Comprimir SEMPRE ou só quando passar de um limiar** (ex.: > 20 MB)? Comprimir sempre garante uniformidade; só acima do limiar é mais rápido pra quem já manda MP3 pequeno.
