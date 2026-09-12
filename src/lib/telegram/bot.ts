// Bot Telegram (grammY 1.46) — hanya dua perintah:
//   /mulai <kode-portofolio>  → tautkan chat ini ke portofolio (kode = id
//                               portofolio yang tampil di kotak masuk /pasang)
//   /berhenti                 → lepas tautan
// Bot TIDAK pernah long-polling (`bot.start()`); update masuk lewat webhook
// /api/telegram/webhook. Tanpa TELEGRAM_BOT_TOKEN bot tidak dibuat sama sekali.
import { Bot, type BotConfig, type Context } from "grammy";
import type { UserFromGetMe } from "grammy/types";

import { DISCLAIMER } from "../agent/instructions";
import type { Db } from "../db/client";
import { kodePortofolioValid, lepasChat, portofolioDariKode, tautanUntukChat, tautkanChat } from "./tautan";

export interface OpsiBot {
  /** DB untuk tautan; null → bot menjawab sopan bahwa server belum punya database. */
  db: Db | null;
  /** Info bot suntikan agar `handleUpdate` tidak memanggil getMe (tes). */
  botInfo?: UserFromGetMe;
  /** Fetch suntikan (tes: tiruan api.telegram.org). */
  fetch?: typeof fetch;
}

export const TEKS_BOT = {
  bantuan:
    "Halo! Ini bot Alarm Saham.\n\n" +
    "• /mulai <kode-portofolio>: kirim bendera baru portofoliomu ke chat ini setiap pagi (±06:30 WIB).\n" +
    "• /berhenti: hentikan pengiriman.\n\n" +
    "Kode portofolio ada di bagian “Kotak masuk” halaman /pasang.",
  tanpaDb: "Maaf, server belum punya database, jadi tautan Telegram belum bisa disimpan.",
  kodeKosong: "Tulis kodenya, mis. /mulai 3f1c2a8e-7b4d-4c9a-9e1f-0a2b3c4d5e6f (lihat kotak masuk di halaman /pasang).",
  kodeSalah: "Kode portofolio tidak dikenal. Salin kode persis dari bagian “Kotak masuk” halaman /pasang.",
  tertaut: (n: number) =>
    `Siap. Chat ini tertaut ke portofolio dengan ${n} saham. Setiap pagi (±06:30 WIB) kami kirim hanya bendera BARU, bukan pengulangan tiap hari. Ketik /berhenti untuk berhenti.\n\n${DISCLAIMER}`,
  dilepas: "Tautan dilepas. Chat ini tidak lagi menerima pesan pagi. Ketik /mulai <kode> untuk menautkan lagi.",
  belumTertaut: "Chat ini belum tertaut ke portofolio mana pun.",
} as const;

export function buatBot(token: string, opsi: OpsiBot): Bot {
  const config: BotConfig<Context> = {
    ...(opsi.botInfo ? { botInfo: opsi.botInfo } : {}),
    ...(opsi.fetch ? { client: { fetch: opsi.fetch as never } } : {}),
  };
  const bot = new Bot(token, config);

  const mulai = async (ctx: Context) => {
    const kode = String(ctx.match ?? "").trim();
    if (!opsi.db) return ctx.reply(TEKS_BOT.tanpaDb);
    if (!kode) return ctx.reply(TEKS_BOT.kodeKosong);
    if (!kodePortofolioValid(kode)) return ctx.reply(TEKS_BOT.kodeSalah);
    const p = await portofolioDariKode(opsi.db, kode);
    if (!p || !ctx.chat) return ctx.reply(TEKS_BOT.kodeSalah);
    await tautkanChat(opsi.db, ctx.chat.id, p.owner, p.id);
    return ctx.reply(TEKS_BOT.tertaut(p.symbols.length));
  };

  bot.command("mulai", mulai);
  // /start = perintah bawaan Telegram saat pengguna membuka bot; payload deep-link ikut jadi kode.
  bot.command("start", async (ctx) => (String(ctx.match ?? "").trim() ? mulai(ctx) : ctx.reply(TEKS_BOT.bantuan)));
  bot.command("berhenti", async (ctx) => {
    if (!opsi.db) return ctx.reply(TEKS_BOT.tanpaDb);
    if (!ctx.chat) return;
    const ada = await tautanUntukChat(opsi.db, ctx.chat.id);
    if (!ada) return ctx.reply(TEKS_BOT.belumTertaut);
    await lepasChat(opsi.db, ctx.chat.id);
    return ctx.reply(TEKS_BOT.dilepas);
  });
  bot.command("help", (ctx) => ctx.reply(TEKS_BOT.bantuan));
  bot.on("message", (ctx) => ctx.reply(TEKS_BOT.bantuan));

  bot.catch((err) => {
    console.error(`[telegram] galat saat memproses update ${err.ctx.update.update_id}:`, err.error);
  });
  return bot;
}
