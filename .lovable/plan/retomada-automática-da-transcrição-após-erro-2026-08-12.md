# Retomada automática da transcrição após erro

## Como está hoje

Quando aparece "⚠️ Erro no processamento IA / Transcrevendo… parte 3 de 17", **o processo trava**: ele não tenta sozinho de novo.

O que existe hoje de tentativa é só **dentro de cada parte**:
- 2 tentativas no serviço rápido (Groq), respeitando a espera sugerida quando a recusa é por cota horária;
- se ainda falhar, a parte cai para a IA (Gemini);
- se a IA também falhar, o pipeline inteiro para, grava `erro` e o texto parcial permanece salvo.

Além disso há um limite global de 25 minutos: ao estourar, a reunião vira `erro`. Em uma reunião de 2h42 (17 partes), a cota gratuita de 2h de áudio por hora praticamente garante que uma rodada não termine sozinha.

## O que será feito

1. **Retomar de onde parou**: ao reprocessar, pular as partes já transcritas em vez de recomeçar da parte 1 (guardar quantas partes já foram concluídas junto do texto parcial).
2. **Nova tentativa automática**: quando o erro for de cota/limite temporário, reagendar a continuação sozinha (sem clique do usuário), até um número máximo de rodadas, com intervalo crescente.
3. **Mensagem honesta no card**: em vez de só "Erro no processamento IA", mostrar "Pausado por limite do serviço — retomando automaticamente (parte 3 de 17)" e, quando for erro definitivo, o motivo real com botão "Retomar".
4. **Botão "Retomar transcrição"** na tela da reunião, que continua da última parte concluída.

## Detalhes técnicos

- `reuniao`: usar/estender os campos de status para armazenar `partes_concluidas` e `partes_total` (JSON em `transcricao_erro`/coluna de progresso já usada para "parte N/M", ou nova coluna dedicada se preferir clareza).
- `supabase/functions/transcrever-reuniao/index.ts`:
  - `transcribeChunked` recebe `startIndex` e o texto acumulado, e devolve progresso persistido a cada parte;
  - classificar o erro final: `quota` (retomável) vs `fatal`;
  - em `quota`, gravar status `pausado` e reinvocar a própria função após o intervalo sugerido (auto-chain), com teto de rodadas para não rodar em loop;
  - em `fatal`, gravar `erro` com o motivo.
- Front (`src/routes/reunioes.tsx` + card de transcrição): exibir estado `pausado` com progresso e botão "Retomar transcrição" que chama a função com o mesmo `reuniao_id`.
