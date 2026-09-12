// Pengirim notifikasi harian (tiket 12). Antarmuka tunggal `Pengirim` dengan dua
// implementasi:
//   - PengirimInApp   : tulis ke tabel `inbox` (selalu ada; jalur utama saat
//                       TELEGRAM_BOT_TOKEN kosong — PLAN §7.5).
//   - PengirimTelegram: grammY `Api.sendMessage` ke setiap chat yang pemiliknya
//                       sudah mengetik `/mulai <kode-portofolio>` di bot.
// Setiap pesan keluar memuat penjelasan per saham dan ditutup disclaimer wajib.
import { Api, GrammyError } from "grammy";

import { DISCLAIMER } from "../agent/instructions";
import type { Db } from "../db/client";
import type { StatusSaham } from "./evaluasi";
import { tulisKotakMasuk } from "./inbox";
import { chatUntukPemilik, lepasChat } from "../telegram/tautan";

export interface BenderaBaru {
  symbol: string;
  status: StatusSaham;
  judul: string;
  /** Penjelasan lengkap (template/AI) — sudah ditutup disclaimer. */
  teks: string;
}

export interface KirimanHarian {
  owner: string;
  portfolioId: string;
  runId: string | null;
  today: string;
  bendera: BenderaBaru[];
}

export type NamaPengirim = "inapp" | "telegram";

export interface Pengirim {
  readonly nama: NamaPengirim;
  /** Kirim satu kiriman; mengembalikan jumlah pesan yang benar-benar terkirim. */
  kirim(k: KirimanHarian): Promise<number>;
}

// ---------------------------------------------------------------------------
// In-app
// ---------------------------------------------------------------------------
export class PengirimInApp implements Pengirim {
  readonly nama = "inapp" as const;
  constructor(private readonly db: Db) {}

  async kirim(k: KirimanHarian): Promise<number> {
    return tulisKotakMasuk(
      this.db,
      k.bendera.map((b) => ({
        owner: k.owner,
        portfolioId: k.portfolioId,
        runId: k.runId,
        symbol: b.symbol,
        status: b.status,
        judul: b.judul,
        teks: b.teks,
      })),
    );
  }
}

// ---------------------------------------------------------------------------
// Telegram
// ---------------------------------------------------------------------------
/** Batas aman di bawah 4096 karakter Telegram, menyisakan ruang untuk disclaimer. */
export const MAKS_PANJANG_PESAN = 3500;

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function fmtTanggal(t: string): string {
  const [y, m, d] = t.split("-").map(Number);
  return `${d} ${BULAN[(m || 1) - 1]} ${y}`;
}

const IKON: Record<StatusSaham, string> = { hijau: "🟢", kuning: "🟡", merah: "🔴" };

/**
 * Susun pesan Telegram (teks polos, tanpa parse_mode agar tidak perlu escape).
 * Satu kiriman → satu pesan, dipecah bila melewati batas; setiap potongan
 * ditutup disclaimer (syarat PLAN §2: disclaimer di setiap pesan keluar).
 */
export function susunPesanTelegram(k: KirimanHarian): string[] {
  const kepala = `Alarm Saham: pengecekan pagi ${fmtTanggal(k.today)}\n${k.bendera.length} bendera baru di portofoliomu:\n`;
  const butir = k.bendera.map((b) => {
    const badan = b.teks.replace(DISCLAIMER, "").replace(/\s+$/, "");
    return `\n${IKON[b.status]} ${b.judul}\n${badan}\n`;
  });
  const potongan: string[] = [];
  let sekarang = kepala;
  for (const s of butir) {
    if (sekarang.length + s.length > MAKS_PANJANG_PESAN && sekarang !== kepala) {
      potongan.push(sekarang);
      sekarang = "(lanjutan)\n";
    }
    sekarang += s;
  }
  potongan.push(sekarang);
  return potongan.map((p) => `${p}\n${DISCLAIMER}`);
}

export interface OpsiPengirimTelegram {
  db: Db;
  /** Pengirim mentah; default: grammY `Api(token).sendMessage`. */
  kirimPesan?: (chatId: string, teks: string) => Promise<void>;
  token?: string;
  /** Fetch suntikan (tes: tiruan api.telegram.org). Default grammY (node-fetch). */
  fetch?: typeof fetch;
}

export class PengirimTelegram implements Pengirim {
  readonly nama = "telegram" as const;
  private readonly db: Db;
  private readonly kirimPesan: (chatId: string, teks: string) => Promise<void>;

  constructor(opsi: OpsiPengirimTelegram) {
    this.db = opsi.db;
    if (opsi.kirimPesan) {
      this.kirimPesan = opsi.kirimPesan;
    } else {
      if (!opsi.token) throw new Error("PengirimTelegram butuh token atau kirimPesan");
      const api = new Api(opsi.token, opsi.fetch ? { fetch: opsi.fetch as never } : undefined);
      this.kirimPesan = async (chatId, teks) => {
        await api.sendMessage(chatId, teks, { link_preview_options: { is_disabled: true } });
      };
    }
  }

  async kirim(k: KirimanHarian): Promise<number> {
    const tujuan = await chatUntukPemilik(this.db, k.owner);
    if (tujuan.length === 0 || k.bendera.length === 0) return 0;
    const pesan = susunPesanTelegram(k);
    let terkirim = 0;
    for (const t of tujuan) {
      for (const p of pesan) {
        try {
          await this.kirimPesan(t.chatId, p);
          terkirim += 1;
        } catch (err) {
          // 403 = pengguna memblokir bot → lepaskan tautan agar tidak dicoba tiap pagi.
          if (err instanceof GrammyError && err.error_code === 403) {
            await lepasChat(this.db, t.chatId);
            console.warn(`[telegram] chat ${t.chatId} memblokir bot; tautan dilepas`);
            break;
          }
          console.warn(`[telegram] gagal kirim ke chat ${t.chatId}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
    return terkirim;
  }
}

/** Baca token dari env; undefined bila kosong (→ hanya in-app). */
export function tokenTelegram(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const t = env.TELEGRAM_BOT_TOKEN?.trim();
  return t ? t : undefined;
}
