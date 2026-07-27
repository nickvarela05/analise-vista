/**
 * Google Calendar sync core logic (server-only).
 * Replica itens da tela Atividades Semanais (reuniões, tarefas, demandas, chamados)
 * em uma agenda Google compartilhada da equipe, via connector-gateway.
 */
import { createHash } from "node:crypto";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";
const TIMEZONE = "America/Sao_Paulo";

type Fonte = "reuniao" | "tarefa" | "demanda" | "chamado";

function gcalHeaders(): Record<string, string> {
  const bearer = process.env.LOVABLE_API_KEY;
  const key = process.env.GOOGLE_CALENDAR_API_KEY;
  if (!bearer || !key) {
    throw new Error("LOVABLE_API_KEY ou GOOGLE_CALENDAR_API_KEY não configurados.");
  }
  return {
    Authorization: `Bearer ${bearer}`,
    "X-Connection-Api-Key": key,
    "Content-Type": "application/json",
  };
}

function hashPayload(parts: Array<string | number | null | undefined>): string {
  return createHash("sha1").update(parts.map((p) => String(p ?? "")).join("|")).digest("hex");
}

interface EventPayload {
  summary: string;
  description: string;
  isAllDay: boolean;
  // For dateTime events (reunião): ISO strings; for all-day: YYYY-MM-DD
  start: string;
  end: string;
}

function buildReuniaoPayload(r: {
  titulo: string;
  data_reuniao: string;
  duracao_min: number | null;
  pauta: string | null;
  resumo: string | null;
  status: string;
}): EventPayload {
  const start = new Date(r.data_reuniao);
  const durMin = r.duracao_min && r.duracao_min > 0 ? r.duracao_min : 60;
  const end = new Date(start.getTime() + durMin * 60_000);
  return {
    summary: `[Reunião] ${r.titulo}${r.status === "cancelada" ? " (Cancelada)" : ""}`,
    description: [r.pauta && `Pauta:\n${r.pauta}`, r.resumo && `Resumo:\n${r.resumo}`]
      .filter(Boolean)
      .join("\n\n") || "Reunião do Nexus.",
    isAllDay: false,
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function buildAllDay(prefix: string, titulo: string, data: string, extras: string): EventPayload {
  // data is a YYYY-MM-DD date; Google all-day end is exclusive (next day)
  const startDate = data.slice(0, 10);
  const endDate = new Date(startDate + "T00:00:00Z");
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const endStr = endDate.toISOString().slice(0, 10);
  return {
    summary: `${prefix} ${titulo}`,
    description: extras || `${prefix} do Nexus.`,
    isAllDay: true,
    start: startDate,
    end: endStr,
  };
}

function toGoogleEvent(fonte: Fonte, fonteId: string, p: EventPayload) {
  const base = {
    summary: p.summary,
    description: p.description,
    extendedProperties: {
      private: {
        nexus_source: fonte,
        nexus_source_id: fonteId,
      },
    },
  };
  if (p.isAllDay) {
    return { ...base, start: { date: p.start }, end: { date: p.end } };
  }
  return {
    ...base,
    start: { dateTime: p.start, timeZone: TIMEZONE },
    end: { dateTime: p.end, timeZone: TIMEZONE },
  };
}

async function gcalRequest(
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<Response> {
  return fetch(`${GATEWAY_URL}${path}`, {
    method,
    headers: gcalHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
}

export interface SyncResult {
  ok: boolean;
  criados: number;
  atualizados: number;
  removidos: number;
  ignorados: number;
  erros: string[];
  ultima_sync_em: string;
}

/**
 * Executa uma passagem completa de sincronização Nexus → Google Agenda.
 * Deve ser chamada apenas do servidor (cron ou serverFn autenticada de gestor).
 */
export async function syncGoogleCalendar(
  options: { manual?: boolean } = {},
): Promise<SyncResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const result: SyncResult = {
    ok: true,
    criados: 0,
    atualizados: 0,
    removidos: 0,
    ignorados: 0,
    erros: [],
    ultima_sync_em: new Date().toISOString(),
  };

  const { data: config, error: configErr } = await supabaseAdmin
    .from("google_calendar_config")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (configErr) throw configErr;
  if (!config || !config.google_calendar_id) {
    const erro = "Calendário não configurado.";
    if (config) {
      await supabaseAdmin
        .from("google_calendar_config")
        .update({ ultimo_erro: erro })
        .eq("id", true);
    }
    return { ...result, ok: false, erros: [erro] };
  }
  // Cron respects the auto-sync switch; manual "Sincronizar agora" always runs.
  if (!options.manual && !config.sync_ativo) {
    return { ...result, ok: false, erros: ["Sincronização automática desativada."] };
  }

  const calendarId = encodeURIComponent(config.google_calendar_id);
  const horizonteDias = config.dias_horizonte ?? 30;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const inicio = hoje.toISOString();
  const fim = new Date(hoje.getTime() + horizonteDias * 86_400_000).toISOString();
  const fimData = fim.slice(0, 10);
  const inicioData = inicio.slice(0, 10);

  // 1) Coleta itens da janela
  const [reunioes, tarefas, demandas, chamados] = await Promise.all([
    supabaseAdmin
      .from("reuniao")
      .select("id, titulo, data_reuniao, duracao_min, pauta, resumo, status")
      .gte("data_reuniao", inicio)
      .lte("data_reuniao", fim),
    supabaseAdmin
      .from("todo")
      .select("id, titulo, descricao, data_prevista, status, prioridade")
      .not("data_prevista", "is", null)
      .gte("data_prevista", inicioData)
      .lte("data_prevista", fimData),
    supabaseAdmin
      .from("demanda")
      .select("id, titulo, descricao, prazo, status, prioridade")
      .not("prazo", "is", null)
      .gte("prazo", inicioData)
      .lte("prazo", fimData),
    supabaseAdmin
      .from("chamado_externo")
      .select("id, titulo, descricao, prazo, status, cliente, codigo")
      .not("prazo", "is", null)
      .gte("prazo", inicioData)
      .lte("prazo", fimData),
  ]);

  interface Alvo {
    fonte: Fonte;
    id: string;
    payload: EventPayload;
    hash: string;
    finalizado: boolean;
  }
  const alvos: Alvo[] = [];

  for (const r of reunioes.data ?? []) {
    const payload = buildReuniaoPayload(r);
    alvos.push({
      fonte: "reuniao",
      id: r.id,
      payload,
      hash: hashPayload([payload.summary, payload.description, payload.start, payload.end, r.status]),
      finalizado: r.status === "cancelada",
    });
  }
  for (const t of tarefas.data ?? []) {
    const finalizado = ["producao", "aprovado", "encerrada", "cancelada", "concluida"].includes(t.status);
    if (finalizado) continue;
    const payload = buildAllDay(
      "[Tarefa]",
      t.titulo,
      t.data_prevista!,
      `Prioridade: ${t.prioridade ?? "—"}\nStatus: ${t.status}\n${t.descricao ?? ""}`,
    );
    alvos.push({
      fonte: "tarefa",
      id: t.id,
      payload,
      hash: hashPayload([payload.summary, payload.description, payload.start, t.status]),
      finalizado,
    });
  }
  for (const d of demandas.data ?? []) {
    const finalizado = ["concluida", "cancelada"].includes(d.status);
    if (finalizado) continue;
    const payload = buildAllDay(
      "[Demanda]",
      d.titulo,
      d.prazo!,
      `Prioridade: ${d.prioridade ?? "—"}\nStatus: ${d.status}\n${d.descricao ?? ""}`,
    );
    alvos.push({
      fonte: "demanda",
      id: d.id,
      payload,
      hash: hashPayload([payload.summary, payload.description, payload.start, d.status]),
      finalizado,
    });
  }
  for (const c of chamados.data ?? []) {
    const finalizado = c.status === "finalizado";
    if (finalizado) continue;
    const payload = buildAllDay(
      "[Chamado]",
      `${c.codigo ?? ""} ${c.titulo}`.trim(),
      c.prazo!,
      `Cliente: ${c.cliente ?? "—"}\nStatus: ${c.status}\n${c.descricao ?? ""}`,
    );
    alvos.push({
      fonte: "chamado",
      id: c.id,
      payload,
      hash: hashPayload([payload.summary, payload.description, payload.start, c.status]),
      finalizado,
    });
  }

  // 2) Mapeamentos existentes
  const { data: mapasRaw } = await supabaseAdmin
    .from("google_calendar_evento")
    .select("*");
  const mapas = new Map<string, {
    id: string;
    fonte: string;
    fonte_id: string;
    google_event_id: string;
    google_calendar_id: string;
    conteudo_hash: string;
  }>();
  for (const m of mapasRaw ?? []) mapas.set(`${m.fonte}:${m.fonte_id}`, m);

  const alvosKeys = new Set(alvos.map((a) => `${a.fonte}:${a.id}`));

  // 3) Upsert alvos
  for (const alvo of alvos) {
    const key = `${alvo.fonte}:${alvo.id}`;
    const existente = mapas.get(key);
    try {
      if (!existente) {
        const body = toGoogleEvent(alvo.fonte, alvo.id, alvo.payload);
        const res = await gcalRequest("POST", `/calendars/${calendarId}/events`, body);
        if (!res.ok) {
          result.erros.push(`Criar ${key}: ${res.status} ${await res.text()}`);
          continue;
        }
        const created = (await res.json()) as { id: string };
        await supabaseAdmin.from("google_calendar_evento").insert({
          fonte: alvo.fonte,
          fonte_id: alvo.id,
          google_event_id: created.id,
          google_calendar_id: config.google_calendar_id,
          conteudo_hash: alvo.hash,
        });
        result.criados++;
      } else if (existente.conteudo_hash !== alvo.hash || existente.google_calendar_id !== config.google_calendar_id) {
        // Recriar no calendário certo se mudou
        if (existente.google_calendar_id !== config.google_calendar_id) {
          await gcalRequest(
            "DELETE",
            `/calendars/${encodeURIComponent(existente.google_calendar_id)}/events/${existente.google_event_id}`,
          );
          const body = toGoogleEvent(alvo.fonte, alvo.id, alvo.payload);
          const res = await gcalRequest("POST", `/calendars/${calendarId}/events`, body);
          if (!res.ok) {
            result.erros.push(`Recriar ${key}: ${res.status} ${await res.text()}`);
            continue;
          }
          const created = (await res.json()) as { id: string };
          await supabaseAdmin
            .from("google_calendar_evento")
            .update({
              google_event_id: created.id,
              google_calendar_id: config.google_calendar_id,
              conteudo_hash: alvo.hash,
              ultima_sync_em: new Date().toISOString(),
            })
            .eq("id", existente.id);
          result.atualizados++;
        } else {
          const body = toGoogleEvent(alvo.fonte, alvo.id, alvo.payload);
          const res = await gcalRequest(
            "PATCH",
            `/calendars/${calendarId}/events/${existente.google_event_id}`,
            body,
          );
          if (!res.ok) {
            result.erros.push(`Atualizar ${key}: ${res.status} ${await res.text()}`);
            continue;
          }
          await supabaseAdmin
            .from("google_calendar_evento")
            .update({ conteudo_hash: alvo.hash, ultima_sync_em: new Date().toISOString() })
            .eq("id", existente.id);
          result.atualizados++;
        }
      } else {
        result.ignorados++;
      }
    } catch (e) {
      result.erros.push(`${key}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 4) Remover eventos de itens que saíram da janela / foram finalizados / deletados
  for (const [key, mapa] of mapas) {
    if (alvosKeys.has(key)) continue;
    try {
      const res = await gcalRequest(
        "DELETE",
        `/calendars/${encodeURIComponent(mapa.google_calendar_id)}/events/${mapa.google_event_id}`,
      );
      // 410/404 significam que já não existe no Google; tratar como sucesso
      if (res.ok || res.status === 404 || res.status === 410) {
        await supabaseAdmin.from("google_calendar_evento").delete().eq("id", mapa.id);
        result.removidos++;
      } else {
        result.erros.push(`Remover ${key}: ${res.status} ${await res.text()}`);
      }
    } catch (e) {
      result.erros.push(`Remover ${key}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  result.ok = result.erros.length === 0;
  result.ultima_sync_em = new Date().toISOString();

  await supabaseAdmin
    .from("google_calendar_config")
    .update({
      ultima_sync_em: result.ultima_sync_em,
      ultimo_erro: result.erros.length ? result.erros.slice(0, 3).join(" | ") : null,
    })
    .eq("id", true);

  return result;
}
