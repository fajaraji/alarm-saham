// POST /api/telegram/webhook — penerima update Telegram (grammY, adapter
// `std/http` untuk Web Request/Response App Router). Telegram menyertakan header
// X-Telegram-Bot-Api-Secret-Token yang dicocokkan dengan TELEGRAM_WEBHOOK_SECRET
// (salah → 401). Tanpa TELEGRAM_BOT_TOKEN / secret → 503 dengan pesan sopan
// (PLAN §7.5: Telegram opsional; notifikasi tetap tampil in-app).
// Daftarkan URL-nya sekali: `npm run telegram:set-webhook -- https://<app>`.
import { webhookCallback } from "grammy";

import { botRuntime } from "@/lib/telegram/runtime";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const PESAN_TANPA_BOT = {
  TOKEN_KOSONG: "Bot Telegram belum diaktifkan (TELEGRAM_BOT_TOKEN kosong). Notifikasi tetap tampil di kotak masuk halaman /pasang.",
  SECRET_KOSONG: "TELEGRAM_WEBHOOK_SECRET belum diatur; webhook tidak diterima demi keamanan.",
} as const;

function tanpaBot(alasan: keyof typeof PESAN_TANPA_BOT) {
  return Response.json({ error: { kode: `TELEGRAM_${alasan}`, pesan: PESAN_TANPA_BOT[alasan] } }, { status: 503 });
}

export async function POST(req: Request): Promise<Response> {
  const rt = await botRuntime();
  if (typeof rt === "string") return tanpaBot(rt);
  const handle = webhookCallback(rt.bot, "std/http", {
    secretToken: rt.secret,
    timeoutMilliseconds: 9_000,
    onTimeout: "return",
  });
  try {
    return await handle(req);
  } catch (err) {
    console.error("[api/telegram/webhook]", err);
    // Balas 200 agar Telegram tidak mengulang update yang sama tanpa henti.
    return new Response("diterima", { status: 200 });
  }
}

/** Status ringkas tanpa rahasia — untuk cek cepat di browser. */
export async function GET(): Promise<Response> {
  const rt = await botRuntime();
  return Response.json({ aktif: typeof rt !== "string", ...(typeof rt === "string" ? { alasan: rt } : {}) });
}
