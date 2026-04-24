
# 🎙️ Transcrição + análise IA de reuniões

## Decisões já confirmadas
- **Captura**: apenas upload de arquivo (mp3, m4a, wav, webm, ogg, máx 100MB)
- **Transcrição**: ElevenLabs Scribe (`scribe_v2`, `language_code=por`, `diarize=true`, `tag_audio_events=true`)
- **Análise IA**: automática após transcrever + botão "Regerar com IA" sempre disponível
- **Modelo IA**: `google/gemini-2.5-flash` via Lovable AI Gateway (já configurado)

---

## 1. Migração de banco

Adicionar à tabela `reuniao`:
- `transcricao_status` (novo enum `reuniao_transcricao_status`: `pendente | processando | concluido | erro`, default `pendente`)
- `transcricao_erro` (text, nullable)
- `decisoes` (text[], nullable)
- `participantes_detectados` (text[], nullable)

Habilitar **Realtime** na tabela `reuniao` (`ALTER PUBLICATION supabase_realtime ADD TABLE public.reuniao`) pra UI atualizar sozinha quando o processamento terminar.

## 2. Secret

Pedir `ELEVENLABS_API_KEY` via `add_secret` (campo seguro, não passa pelo chat).
`LOVABLE_API_KEY` ✅ já existe.

## 3. Edge Function `transcrever-reuniao`

Endpoint POST recebe `{ reuniao_id, audio_path }`:
1. UPDATE `transcricao_status='processando'`
2. Baixa áudio do bucket `reuniao-audios` via service role
3. Chama ElevenLabs Scribe → monta transcrição formatada por speaker
4. Chama Lovable AI (`gemini-2.5-flash`) com **tool calling estruturado** pra extrair: `resumo`, `pauta`, `proximos_passos`, `decisoes`, `participantes_detectados`
5. UPDATE final com todos os campos + `status='concluido'`
6. Tratamento de erro: salva mensagem em `transcricao_erro`, status='erro'
7. Captura 429 (rate limit) e 402 (créditos) com mensagens amigáveis

## 4. Edge Function `analisar-transcricao`

POST recebe `{ reuniao_id }`. Pula transcrição, só roda a IA novamente sobre `reuniao.transcricao` existente. Usado pelo botão "Regerar".

## 5. Componente `UploadAudioReuniao.tsx`

Dentro do dialog de criar/editar reunião, seção destacada **"🎙️ Áudio e análise automática"**:
- Drop zone (drag & drop ou clique)
- Validação client-side (tipo + tamanho)
- Player nativo após upload
- Barra de progresso em 3 fases: 📤 Enviando → 🎧 Transcrevendo → ✨ Analisando
- Polling/realtime no `transcricao_status`
- Mensagem final: "Pronto! Campos preenchidos automaticamente — você pode editar."
- Estado de erro com botão "Tentar novamente"

## 6. Refatorar `ReuniaoDialog`

- `<UploadAudioReuniao />` no topo
- Badge **"✨ Gerado por IA"** ao lado de Resumo, Pauta, Próximos passos, Decisões quando preenchidos pela IA
- Botão **"🔄 Regerar análise com IA"**
- Accordion **"Ver transcrição completa"** (formatada por speaker)
- Campo novo **"Decisões tomadas"** (lista)

## 7. Refatorar `ReuniaoSheet` (visualização) e `ReuniaoCard`

- Ícone ✨ no card quando há IA
- Sheet: nova seção "Decisões tomadas" + chips "Participantes detectados pela IA" + accordion da transcrição completa formatada
- Player de áudio (já existe) — mantido

## 8. Componente auxiliar `TranscricaoFormatada.tsx`

Renderiza transcrição agrupada por speaker com avatar/cor por falante.

---

## 📦 Arquivos

**Novos:**
- `supabase/migrations/<timestamp>_reuniao_ia.sql`
- `supabase/functions/transcrever-reuniao/index.ts`
- `supabase/functions/analisar-transcricao/index.ts`
- `src/components/reunioes/UploadAudioReuniao.tsx`
- `src/components/reunioes/TranscricaoFormatada.tsx`

**Modificados:**
- `src/routes/reunioes.tsx` (dialog criar/editar + Sheet de detalhe + card + tipos)

---

## ⏱️ Expectativa de tempo (UX)

| Reunião | Total estimado |
|---|---|
| 15 min | ~20s |
| 1h | ~75s |
| 2h | ~3min |

Como o processamento é assíncrono e usa Realtime, o usuário pode fechar o dialog e a UI atualiza sozinha quando termina.
