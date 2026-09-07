// Tautan chat Telegram ↔ pemilik (tabel `telegram_links`). Dibuat oleh perintah
// `/mulai <kode-portofolio>` di bot; dipakai cron untuk tahu ke chat mana
// bendera baru dikirim. Satu chat = satu pemilik (upsert per chat_id).
import { eq } from "drizzle-orm";

import type { Db } from "../db/client";
import { portfolios, telegramLinks } from "../db/schema";

export interface TautanChat {
  chatId: string;
  owner: string;
  portfolioId: string | null;
  linkedAt: string;
}

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Kode portofolio yang diketik pengguna di Telegram = id baris `portfolios`. */
export function kodePortofolioValid(kode: string): boolean {
  return POLA_UUID.test(kode.trim());
}

/** Cari portofolio berdasarkan kode; null bila tidak ada. */
export async function portofolioDariKode(db: Db, kode: string): Promise<{ id: string; owner: string; symbols: string[] } | null> {
  if (!kodePortofolioValid(kode)) return null;
  const [p] = await db
    .select({ id: portfolios.id, owner: portfolios.ownerToken, symbols: portfolios.symbols })
    .from(portfolios)
    .where(eq(portfolios.id, kode.trim().toLowerCase()))
    .limit(1);
  return p ?? null;
}

export async function tautkanChat(db: Db, chatId: string | number, owner: string, portfolioId: string | null): Promise<TautanChat> {
  const id = String(chatId);
  const [row] = await db
    .insert(telegramLinks)
    .values({ chatId: id, ownerToken: owner, portfolioId })
    .onConflictDoUpdate({ target: telegramLinks.chatId, set: { ownerToken: owner, portfolioId, linkedAt: new Date() } })
    .returning();
  return { chatId: row.chatId, owner: row.ownerToken, portfolioId: row.portfolioId, linkedAt: row.linkedAt.toISOString() };
}

/** Lepas tautan chat; mengembalikan true bila memang ada yang dilepas. */
export async function lepasChat(db: Db, chatId: string | number): Promise<boolean> {
  const rows = await db.delete(telegramLinks).where(eq(telegramLinks.chatId, String(chatId))).returning({ chatId: telegramLinks.chatId });
  return rows.length > 0;
}

export async function tautanUntukChat(db: Db, chatId: string | number): Promise<TautanChat | null> {
  const [row] = await db.select().from(telegramLinks).where(eq(telegramLinks.chatId, String(chatId))).limit(1);
  return row ? { chatId: row.chatId, owner: row.ownerToken, portfolioId: row.portfolioId, linkedAt: row.linkedAt.toISOString() } : null;
}

export async function chatUntukPemilik(db: Db, owner: string): Promise<TautanChat[]> {
  const rows = await db.select().from(telegramLinks).where(eq(telegramLinks.ownerToken, owner));
  return rows.map((row) => ({ chatId: row.chatId, owner: row.ownerToken, portfolioId: row.portfolioId, linkedAt: row.linkedAt.toISOString() }));
}
