// Pemuat data satu emiten untuk layar putar ulang (server-side saja).
// Dua jalur: DB (Drizzle; pdf_url suspensi ikut) atau sumber kejadian umum
// (fixture) lewat `muatEmitenDariSumber`.
import { asc, eq } from "drizzle-orm";

import { catatanHanyaSuspensi } from "../cakupan";
import type { Db } from "../db/client";
import { suspensions, symbols } from "../db/schema";
import { hariIni, pastikanTanggal } from "../engine/dates";
import { fromDb, kosong, type EmitenEvents, type Group, type UniverseEntry } from "../engine/events";
import type { SumberKejadian } from "../engine/sumber";
import { turunkanKejadian, type Kejadian } from "./kejadian";

export type StatusEmiten =
  /** Ada di universe uji dan punya data laporan. */
  | "lengkap"
  /** Ada di universe uji, tetapi endpoint `dates` mengembalikan 404 (docs/universe-pull.md). */
  | "laporan_tidak_tersedia"
  /** Tidak di universe uji; hanya muncul di feed suspensi seluruh bursa. */
  | "hanya_suspensi"
  /** Tidak ada satu pun baris di data kami. */
  | "tidak_ada";

export interface EmitenPutarUlang {
  symbol: string;
  status: StatusEmiten;
  companyName: string | null;
  group: Group | null;
  targetEventDate: string | null;
  today: string;
  events: EmitenEvents;
  kejadian: Kejadian[];
  /**
   * Catatan jujur tentang keterbatasan data emiten ini, KHUSUS yang mengubah
   * apa yang dilihat di layar: hanya ada data suspensi, di luar universe uji,
   * laporan keuangan tidak tersedia di sumber, atau server memakai data contoh.
   *
   * Dua catatan yang dulu ada di sini dikeluarkan (tiket 19), karena tampil di
   * hampir SEMUA emiten sehingga kotaknya jadi hiasan yang diabaikan:
   * - "tidak ada filing orang dalam": lampu layar ini memakai aturan bawaan
   *   (suspensi ATAU laporan hilang ATAU ekuitas negatif), yang tidak memakai
   *   data filing sama sekali. Catatan itu tidak mengubah apa pun di layar.
   * - "angka ekuitas tidak ditarik": catatan ini MEMANG mengubah lampu, jadi
   *   tidak dibuang, melainkan dipindah ke `ekuitasTidakDinilai` dan ditulis
   *   satu baris di samping lampu, tempat dampaknya berada.
   */
  catatan: string[];
  /**
   * true bila emiten punya daftar kuartal laporan tetapi angka ekuitasnya tidak
   * kami tarik (laporan keuangan kuartalan 1 kredit per kuartal, hanya ditarik
   * untuk 18 emiten delisting). Blok ekuitas negatif di lampu tidak bisa dinilai.
   */
  ekuitasTidakDinilai: boolean;
  /**
   * true bila seluruh isi halaman berasal dari fixture contoh (server tanpa
   * DATABASE_URL dan tanpa ./.pglite), bukan dari data Sectors. UI WAJIB
   * menampilkannya sebagai label, karena angka fixture bersifat ilustratif.
   */
  sumberContoh: boolean;
}

/** 8 emiten yang endpoint `dates` Sectors-nya 404 saat tiket 07 (docs/universe-pull.md). */
export const EMITEN_DATES_404 = ["COWL", "SUGI", "MABA", "SKYB", "KBRI", "NUSA", "RIMO", "SIMA"] as const;

const POLA_KODE = /^[A-Z]{2,5}$/;

/** Normalisasi kode saham dari input pengguna; null bila bukan 2–5 huruf. */
export function normalKode(masukan: string | null | undefined): string | null {
  const s = (masukan ?? "").trim().toUpperCase().replace(/\.JK$/, "");
  return POLA_KODE.test(s) ? s : null;
}

interface BahanEmiten {
  symbol: string;
  today: string;
  /** Baris universe (null bila tidak ada di tabel `symbols`/fixture universe). */
  baris: { companyName: string | null; group: Group; targetEventDate: string | null } | null;
  pdfUrl: Record<string, string | null>;
  events: EmitenEvents;
  /** true bila bahan berasal dari fixture contoh (bukan DB Sectors). */
  contoh?: boolean;
}

function kodeTidakSah(masukan: string, today: string, contoh = false): EmitenPutarUlang {
  return {
    symbol: (masukan ?? "").trim().toUpperCase(),
    status: "tidak_ada",
    companyName: null,
    group: null,
    targetEventDate: null,
    today,
    events: kosong(""),
    kejadian: [],
    catatan: ["Kode saham harus 2–5 huruf, mis. SRIL."],
    ekuitasTidakDinilai: false,
    sumberContoh: contoh,
  };
}

/** Susun hasil akhir dari bahan mentah (murni; dipakai kedua jalur). */
export function susunEmiten(b: BahanEmiten): EmitenPutarUlang {
  const { symbol, today, baris, events } = b;
  const contoh = b.contoh === true;
  const kejadian = turunkanKejadian({ events, pdfUrl: b.pdfUrl, today, contoh });
  const diUniverse = baris !== null;
  const adaData =
    events.suspensions.length +
      events.quarters.length +
      events.rightIssues.length +
      events.financials.length +
      events.filings.length >
    0;

  const catatan: string[] = [];
  let status: StatusEmiten;
  if (diUniverse && events.quarters.length > 0) {
    status = "lengkap";
  } else if (diUniverse) {
    status = "laporan_tidak_tersedia";
    // Tanpa nama endpoint atau nomor tiket (DESIGN.md aturan 8): rinciannya ada
    // di docs/universe-pull.md, bukan di layar pengguna.
    catatan.push(`Laporan keuangan ${symbol} tidak tersedia di sumber, jadi yang tampil hanya data suspensi.`);
  } else if (adaData) {
    status = "hanya_suspensi";
    // Cakupan mengikuti sumber yang benar-benar dipakai (lihat src/lib/cakupan.ts):
    // angka universe tidak boleh dipakukan di kalimat.
    catatan.push(catatanHanyaSuspensi(symbol, contoh));
  } else {
    status = "tidak_ada";
  }
  // Catatan "ini data contoh" tidak dibuat lagi: label sumber di atas rekaman,
  // pembuka halaman, dan footer (yang menyebut angkanya ilustratif) sudah
  // mengatakannya di layar yang sama (DESIGN.md aturan 1).
  // Lihat dokumentasi `catatan` dan `ekuitasTidakDinilai` di atas: catatan
  // filing tidak lagi dibuat, catatan ekuitas pindah ke samping lampu.
  const ekuitasTidakDinilai = status === "lengkap" && events.financials.length === 0;

  return {
    symbol,
    status,
    companyName: baris?.companyName ?? null,
    group: baris?.group ?? null,
    targetEventDate: baris?.targetEventDate ?? null,
    today,
    events,
    kejadian,
    catatan,
    ekuitasTidakDinilai,
    sumberContoh: contoh,
  };
}

/** Jalur DB: tabel symbols + suspensions (pdf_url) + fromDb(db).events. */
export async function muatEmiten(db: Db, symbolMasukan: string, today: string = hariIni()): Promise<EmitenPutarUlang> {
  const t = pastikanTanggal("today", today);
  const symbol = normalKode(symbolMasukan);
  if (!symbol) return kodeTidakSah(symbolMasukan, t);

  const [baris, susp, events] = await Promise.all([
    db
      .select({
        companyName: symbols.companyName,
        group: symbols.group,
        targetEventDate: symbols.targetEventDate,
      })
      .from(symbols)
      .where(eq(symbols.symbol, symbol))
      .limit(1),
    db
      .select({ date: suspensions.suspensionDate, pdfUrl: suspensions.pdfUrl })
      .from(suspensions)
      .where(eq(suspensions.symbol, symbol))
      .orderBy(asc(suspensions.suspensionDate)),
    fromDb(db).events(symbol),
  ]);

  return susunEmiten({
    symbol,
    today: t,
    baris: baris[0] ?? null,
    pdfUrl: Object.fromEntries(susp.map((s) => [s.date, s.pdfUrl ?? null])),
    events,
  });
}

/** Jalur umum: DB bila ada, selain itu sumber kejadian + universe (fixture; tanpa pdf_url). */
export async function muatEmitenDariSumber(
  sumber: Pick<SumberKejadian, "db" | "source" | "universe"> & { jenis?: SumberKejadian["jenis"] },
  symbolMasukan: string,
  today: string = hariIni(),
): Promise<EmitenPutarUlang> {
  if (sumber.db) return muatEmiten(sumber.db, symbolMasukan, today);
  const contoh = sumber.jenis === "fixture";
  const t = pastikanTanggal("today", today);
  const symbol = normalKode(symbolMasukan);
  if (!symbol) return kodeTidakSah(symbolMasukan, t, contoh);
  const [events, universe] = await Promise.all([sumber.source.events(symbol), sumber.universe()]);
  const u: UniverseEntry | undefined = universe.find((x) => x.symbol === symbol);
  return susunEmiten({
    symbol,
    today: t,
    baris: u ? { companyName: null, group: u.group, targetEventDate: u.targetEventDate ?? null } : null,
    pdfUrl: {},
    events,
    contoh,
  });
}
