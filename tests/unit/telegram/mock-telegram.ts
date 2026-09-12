// Tiruan api.telegram.org untuk grammY (disuntik lewat opsi `fetch`) — tidak ada
// panggilan jaringan. Mencatat setiap metode & body yang dikirim bot.
import type { Update, UserFromGetMe } from "grammy/types";

export const BOT_INFO: UserFromGetMe = {
  id: 123,
  is_bot: true,
  first_name: "AlarmSahamUji",
  username: "alarm_saham_uji_bot",
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
} as UserFromGetMe;

/** Token palsu yang TIDAK cocok pola pemindai rahasia (\d{8,10}:[A-Za-z0-9_-]{35}). */
export const TOKEN_UJI = "123:uji";

export interface PanggilanTelegram {
  url: string;
  metode: string;
  body: Record<string, unknown>;
}

export interface OpsiTiruan {
  /** Jawab error Telegram untuk metode tertentu (mis. 403 saat pengguna memblokir bot). */
  galat?: Partial<Record<string, { error_code: number; description: string }>>;
}

export function fetchTelegramTiruan(opsi: OpsiTiruan = {}) {
  const panggilan: PanggilanTelegram[] = [];
  const fetch = async (masukan: unknown, init?: { body?: unknown }): Promise<Response> => {
    const url = String(masukan);
    if (!url.startsWith("https://api.telegram.org/")) throw new Error(`tiruan Telegram: URL asing ${url}`);
    const metode = url.split("/").pop() ?? "";
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    panggilan.push({ url, metode, body });
    const g = opsi.galat?.[metode];
    if (g) {
      return new Response(JSON.stringify({ ok: false, ...g }), { status: g.error_code, headers: { "content-type": "application/json" } });
    }
    let result: unknown = true;
    if (metode === "getMe") result = BOT_INFO;
    if (metode === "sendMessage") {
      result = { message_id: panggilan.length, date: 0, chat: { id: body.chat_id, type: "private" }, text: body.text };
    }
    return new Response(JSON.stringify({ ok: true, result }), { status: 200, headers: { "content-type": "application/json" } });
  };
  return { fetch: fetch as unknown as typeof globalThis.fetch, panggilan };
}

let noUpdate = 0;

/** Update Telegram berisi satu pesan teks dari chat privat (perintah diberi entity bot_command). */
export function updateTeks(chatId: number, text: string): Update {
  noUpdate += 1;
  const perintah = /^\/(\w+)/.exec(text);
  return {
    update_id: noUpdate,
    message: {
      message_id: noUpdate,
      date: 1_700_000_000 + noUpdate,
      chat: { id: chatId, type: "private", first_name: "Uji" },
      from: { id: chatId, is_bot: false, first_name: "Uji" },
      text,
      ...(perintah ? { entities: [{ type: "bot_command" as const, offset: 0, length: perintah[0].length }] } : {}),
    },
  };
}
