// Kotak masuk in-app di server (tabel `inbox`): jalur notifikasi utama saat
// TELEGRAM_BOT_TOKEN kosong (PLAN §7.5) — dan tetap ditulis walau Telegram ada,
// agar halaman /pasang selalu memuat riwayat bendera yang sama.
import { and, desc, eq, isNull } from "drizzle-orm";

import type { Db } from "../db/client";
import { inbox } from "../db/schema";
import type { StatusSaham } from "./evaluasi";
import type { PesanKotakMasuk } from "./simpan";

export const MAKS_MUAT_INBOX = 50;

export interface PesanInboxBaru {
  owner: string;
  portfolioId: string | null;
  runId: string | null;
  symbol: string;
  status: StatusSaham;
  judul: string;
  teks: string;
}

const STATUS_SAH: StatusSaham[] = ["hijau", "kuning", "merah"];

function statusAman(s: string): StatusSaham {
  return (STATUS_SAH as string[]).includes(s) ? (s as StatusSaham) : "kuning";
}

/** Tulis bendera baru; mengembalikan jumlah baris yang tersimpan. */
export async function tulisKotakMasuk(db: Db, pesan: PesanInboxBaru[]): Promise<number> {
  if (pesan.length === 0) return 0;
  const rows = await db
    .insert(inbox)
    .values(
      pesan.map((p) => ({
        ownerToken: p.owner,
        portfolioId: p.portfolioId,
        runId: p.runId,
        symbol: p.symbol,
        status: p.status,
        judul: p.judul,
        teks: p.teks,
      })),
    )
    .returning({ id: inbox.id });
  return rows.length;
}

/** Pesan terbaru milik pemilik, bentuknya sama dengan kotak masuk lokal (klien tinggal menggabung). */
export async function muatKotakMasuk(db: Db, owner: string, batas: number = MAKS_MUAT_INBOX): Promise<PesanKotakMasuk[]> {
  const rows = await db
    .select()
    .from(inbox)
    .where(eq(inbox.ownerToken, owner))
    .orderBy(desc(inbox.createdAt))
    .limit(batas);
  return rows.map((r) => ({
    id: r.id,
    waktu: r.createdAt.toISOString(),
    symbol: r.symbol,
    status: statusAman(r.status),
    judul: r.judul,
    teks: r.teks,
    baru: r.readAt === null,
  }));
}

export async function jumlahBelumDibaca(db: Db, owner: string): Promise<number> {
  const rows = await db
    .select({ id: inbox.id })
    .from(inbox)
    .where(and(eq(inbox.ownerToken, owner), isNull(inbox.readAt)));
  return rows.length;
}

/** Tandai semua pesan pemilik sudah dibaca; mengembalikan jumlah yang berubah. */
export async function tandaiKotakMasukDibaca(db: Db, owner: string, pada: Date = new Date()): Promise<number> {
  const rows = await db
    .update(inbox)
    .set({ readAt: pada })
    .where(and(eq(inbox.ownerToken, owner), isNull(inbox.readAt)))
    .returning({ id: inbox.id });
  return rows.length;
}
