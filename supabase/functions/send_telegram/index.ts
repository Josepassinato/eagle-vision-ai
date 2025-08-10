import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

function parseAllowedOrigins(): string[] {
  const env = Deno.env.get("ALLOWED_ORIGINS") || "https://panel.inigrai.com";
  return env.split(",").map((s) => s.trim()).filter(Boolean);
}

function corsHeadersFor(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = parseAllowedOrigins();
  const isAllowed = allowed.includes(origin);
  const base = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  } as Record<string, string>;
  if (isAllowed) base["Access-Control-Allow-Origin"] = origin;
  return { headers: base, isAllowed };
}

interface SendTelegramRequest {
  chat_id?: string;
  text?: string;
}

async function getChatIds(token: string): Promise<string[]> {
  const url = `https://api.telegram.org/bot${token}/getUpdates`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = await resp.json();
    const chatIds = new Set<string>();
    for (const update of data.result ?? []) {
      for (const key of ["message","edited_message","channel_post","edited_channel_post","my_chat_member"]) {
        const node = update[key];
        if (!node) continue;
        const chat = node.chat ?? node?.chat ?? undefined;
        if (chat?.id) chatIds.add(String(chat.id));
      }
    }
    return Array.from(chatIds);
  } catch {
    return [];
  }
}

async function sendMessage(token: string, chatId: string, text: string) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  if (!resp.ok) throw new Error(`Telegram sendMessage ${resp.status}`);
  return await resp.json();
}

serve(async (req) => {
  // Preflight
  if (req.method === "OPTIONS") {
    const { headers, isAllowed } = corsHeadersFor(req);
    return new Response(null, { status: isAllowed ? 204 : 403, headers });
  }

  const start = Date.now();
  try {
    const { headers, isAllowed } = corsHeadersFor(req);
    if (!isAllowed) return new Response(JSON.stringify({ error: "CORS not allowed" }), { status: 403, headers: { ...headers, "Content-Type": "application/json" } });

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Use POST" }), { status: 405, headers: { ...headers, "Content-Type": "application/json" } });
    }

    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const configuredChat = Deno.env.get("TELEGRAM_CHAT_ID");
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing TELEGRAM_BOT_TOKEN" }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } });
    }

    const body = (await req.json().catch(() => ({}))) as SendTelegramRequest;
    const text = body.text || `[Visão de Águia] Teste via Supabase\n${new Date().toISOString()}`;

    let chatIds: string[] = [];
    if (body.chat_id) chatIds = [body.chat_id];
    else if (configuredChat && configuredChat.trim().length > 0) chatIds = configuredChat.split(",").map((s) => s.trim()).filter(Boolean);
    else chatIds = await getChatIds(token);

    if (!chatIds.length) {
      return new Response(JSON.stringify({ ok: false, error: "Nenhum chat_id encontrado. Envie /start para o bot." }), { status: 400, headers: { ...headers, "Content-Type": "application/json" } });
    }

    let sent = 0;
    for (const cid of chatIds) {
      try { await sendMessage(token, cid, text); sent++; } catch (_) {}
    }

    const latency_ms = Date.now() - start;
    const resp = { ok: true, sent_to_chats: sent, total_chats: chatIds.length, chat_ids: chatIds, latency_ms };
    return new Response(JSON.stringify(resp), { status: sent > 0 ? 200 : 500, headers: { ...headers, "Content-Type": "application/json" } });
  } catch (error: any) {
    const { headers } = corsHeadersFor(req);
    return new Response(JSON.stringify({ ok: false, error: error?.message || String(error) }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } });
  }
});
