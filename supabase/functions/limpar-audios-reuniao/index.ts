// Limpeza automática dos áudios de reunião (decisão do Nickolas em 14/10/2026: "pode ser").
//
// O plano gratuito do Supabase tem 1 GB para arquivos; em 13/10/2026 eram 199 MB, 194 MB deles
// de áudios de reunião (~20 MB por reunião de 40 min). Depois que a transcrição está pronta, o
// áudio só ocupa espaço: a pauta, o resumo e o texto continuam na reunião.
//
// Regra: apaga o áudio de reuniões com transcrição concluída (e não vazia) e data há mais de
// DIAS_PADRAO dias. Reunião sem transcrição, com erro ou em andamento, nunca é tocada.
//
// Corpo (opcional): { "dias": 30, "simular": true } — simular só lista o que seria apagado.
// Acesso: o cron interno (x-cron-secret) ou a chave service_role; ninguém mais.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const BUCKET = "reuniao-audios";
const DIAS_PADRAO = 30;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

function autorizado(req: Request): boolean {
  const cron = req.headers.get("x-cron-secret") ?? "";
  if (CRON_SECRET && cron === CRON_SECRET) return true;
  const auth = req.headers.get("Authorization") ?? "";
  return auth === `Bearer ${SERVICE_KEY}`;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (!autorizado(req)) return json({ error: "Forbidden" }, 403);

  const corpo = await req.json().catch(() => ({}));
  const dias =
    Number.isFinite(corpo?.dias) && corpo.dias >= 7 ? Math.floor(corpo.dias) : DIAS_PADRAO;
  const simular = corpo?.simular === true;
  const limite = new Date(Date.now() - dias * 86_400_000).toISOString();

  const { data: reunioes, error } = await admin
    .from("reuniao")
    .select("id, titulo, data_reuniao, audio_path, audio_size, transcricao")
    .not("audio_path", "is", null)
    .eq("transcricao_status", "concluido")
    .lt("data_reuniao", limite);
  if (error) return json({ error: error.message }, 500);

  const alvo = (reunioes ?? []).filter((r) => (r.transcricao ?? "").trim().length > 0);
  const resumo = alvo.map((r) => ({
    titulo: r.titulo,
    data: r.data_reuniao,
    mb: Math.round(((r.audio_size ?? 0) / 1_048_576) * 10) / 10,
  }));
  const totalMb = Math.round(resumo.reduce((s, r) => s + r.mb, 0));

  if (simular || alvo.length === 0) {
    return json({ simular, dias, apagaria: alvo.length, total_mb: totalMb, reunioes: resumo });
  }

  let apagados = 0;
  const falhas: string[] = [];
  for (const r of alvo) {
    // Apaga o arquivo primeiro; só limpa a reunião se o arquivo saiu, para não perder a referência.
    const { error: errRemove } = await admin.storage.from(BUCKET).remove([r.audio_path!]);
    if (errRemove) {
      falhas.push(`${r.titulo}: ${errRemove.message}`);
      continue;
    }
    const { error: errUpd } = await admin
      .from("reuniao")
      .update({ audio_path: null, audio_size: null, audio_mime: null })
      .eq("id", r.id);
    if (errUpd)
      falhas.push(`${r.titulo} (arquivo apagado, reunião não atualizada): ${errUpd.message}`);
    else apagados++;
  }

  console.log(
    `[limpar-audios] ${apagados} áudio(s) apagado(s), ~${totalMb} MB; falhas: ${falhas.length}`,
  );
  return json({ dias, apagados, total_mb: totalMb, falhas, reunioes: resumo });
});
