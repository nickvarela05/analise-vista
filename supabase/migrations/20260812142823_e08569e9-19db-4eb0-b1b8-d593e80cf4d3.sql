UPDATE public.reuniao
SET transcricao_status = 'pausado',
    transcricao_partes_feitas = 3,
    transcricao_partes_total = 17,
    transcricao_rodadas = 0,
    transcricao_erro = 'Pausado na parte 3 de 17 — clique em "Retomar transcrição" para continuar de onde parou.'
WHERE id = 'bd82104d-5c0d-4ac4-84e2-d823604a49fd'
  AND transcricao_status = 'processando';