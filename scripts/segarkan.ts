#!/usr/bin/env node
// Penyegaran data kelas A (tiket 42).
//
//   npm run segarkan -- --dry                  rencana + perkiraan kredit, TANPA panggilan API
//   npm run segarkan                           suspensi sampai hari ini, lalu daftar kuartal
//   npm run segarkan -- --hanya=suspensi       satu langkah saja (suspensi | dates)
//   npm run segarkan -- --maks=40              batas kredit untuk run ini (default 100)
//   npm run segarkan -- --pglite[=DIR]         DATABASE_URL kosong → PGlite lokal (./.pglite)
//
// Kenapa ada: tabel kelas A adalah snapshot hasil `pull-universe` tiket 07 dan
// tidak berubah sendiri. Tanpa penyegaran, saham yang disuspensi minggu ini
// tidak pernah muncul, dan mulai 28 Okt 2026 blok "laporan hilang" akan
// berbunyi palsu untuk emiten sehat yang laporan kuartal 2-nya belum kami tarik.
//
// Disiplin kredit (docs/data-proof.md §5–§6):
// - Setiap panggilan tercatat di api_ledger; angka sebelum/sesudah dicetak, jadi
//   biayanya terbukti, bukan ditaksir.
// - Berhenti bila kredit run ini mencapai `--maks`, atau bila sisa menurut
//   ledger turun di bawah cadangan provider (CreditReserveError).
// - Suspensi: `end` = hari ini, jadi cache-nya hanya 24 jam (bukan permanen).
// - Daftar kuartal: cache-nya permanen karena data historis tidak berubah, maka
//   baris cache emiten yang disegarkan DIHAPUS lebih dulu. Itu satu-satunya
//   cara memperoleh kuartal baru, dan sengaja dilakukan terang-terangan.
import { desc, eq, sql } from "drizzle-orm";

import { CacheDb, CreditReserveError, LedgerDb, SectorsApiError, sectorsProviderDariEnv, type SectorsProvider } from "../src/lib/data";
import type { Db } from "../src/lib/db";
import { bukaDb } from "../src/lib/db/buka";
import { apiCache, apiLedger, reportDates, suspensions, symbols } from "../src/lib/db/schema";
import { hariIni } from "../src/lib/engine/dates";
import { barisReportDates } from "../src/lib/universe/aturan";
import { DIKETAHUI_404 } from "../src/lib/universe/daftar";

const LIMIT_SUSPENSI = 30;
const MAKS_HALAMAN_SUSPENSI = 25;
const MAKS_KREDIT_DEFAULT = 100;
/** Halaman berturut-turut tanpa baris baru sebelum paging suspensi dihentikan. */
const HALAMAN_TANPA_BARU_MAKS = 2;

type Langkah = "suspensi" | "dates";

interface Argumen {
  dry: boolean;
  maks: number;
  hanya: Langkah[];
  pgliteDir?: string;
  help: boolean;
}

function urai(argv: string[]): Argumen {
  const arg: Argumen = { dry: false, maks: MAKS_KREDIT_DEFAULT, hanya: ["suspensi", "dates"], help: false };
  for (const a of argv) {
    if (a === "--dry") arg.dry = true;
    else if (a === "--help" || a === "-h") arg.help = true;
    else if (a.startsWith("--maks=")) arg.maks = Number(a.slice(7));
    else if (a === "--pglite") arg.pgliteDir = "";
    else if (a.startsWith("--pglite=")) arg.pgliteDir = a.slice(9);
    else if (a.startsWith("--hanya=")) {
      arg.hanya = a
        .slice(8)
        .split(",")
        .map((x) => x.trim())
        .filter((x): x is Langkah => x === "suspensi" || x === "dates");
    }
  }
  return arg;
}

function bantuan(): string {
  return [
    "Pemakaian: npm run segarkan -- [--dry] [--hanya=suspensi,dates] [--maks=N] [--pglite[=DIR]]",
    "",
    "  --dry          hanya cetak rencana dan perkiraan kredit; tidak memanggil API",
    "  --hanya=...    langkah yang dijalankan (suspensi, dates)",
    `  --maks=N       batas kredit run ini (default ${MAKS_KREDIT_DEFAULT})`,
    "  --pglite[=DIR] pakai PGlite lokal saat DATABASE_URL kosong (default ./.pglite)",
  ].join("\n");
}

const tidur = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Jeda antar panggilan per emiten; Sectors membalas 429 bila terlalu rapat. */
const JEDA_ANTAR_PANGGILAN_MS = 1_500;
/** Tunggu berapa lama sesudah 429, per percobaan. */
const TUNGGU_429_MS = [5_000, 15_000, 45_000];

/**
 * Panggil `fn`, lalu ulangi bila Sectors membalas 429 (batas laju), sampai
 * daftar tunggu habis. 429 tidak menghabiskan kredit: yang gagal tidak
 * dilayani. Selain 429, galat dilempar apa adanya.
 */
async function coba<T>(fn: () => Promise<T>, nama: string): Promise<T> {
  for (let i = 0; ; i += 1) {
    try {
      return await fn();
    } catch (err) {
      const kena429 = err instanceof SectorsApiError && err.status === 429;
      if (!kena429 || i >= TUNGGU_429_MS.length) throw err;
      console.log(`  ${nama}: kena batas laju (429), menunggu ${TUNGGU_429_MS[i] / 1000} detik`);
      await tidur(TUNGGU_429_MS[i]);
    }
  }
}

/** Kredit yang sudah tercatat di ledger (dipakai untuk selisih sebelum/sesudah). */
async function kreditTerpakai(db: Db): Promise<number> {
  const [r] = await db.select({ n: sql<number>`coalesce(sum(${apiLedger.credits}), 0)::int` }).from(apiLedger);
  return r?.n ?? 0;
}

async function tanggalSuspensiTerbaru(db: Db): Promise<string | null> {
  const [r] = await db.select({ d: suspensions.suspensionDate }).from(suspensions).orderBy(desc(suspensions.suspensionDate)).limit(1);
  return r?.d ?? null;
}

async function kuartalTerbaru(db: Db): Promise<string | null> {
  const [r] = await db.select({ d: reportDates.reportDate }).from(reportDates).orderBy(desc(reportDates.reportDate)).limit(1);
  return r?.d ?? null;
}

/**
 * Emiten universe, PALING BASI LEBIH DULU (kuartal terakhirnya paling lama,
 * yang belum punya kuartal sama sekali paling depan). Dengan begitu `--maks`
 * yang kecil tetap mengenai emiten yang paling berisiko berbunyi palsu.
 */
async function simbolUniverse(db: Db): Promise<string[]> {
  const rows = await db
    .select({ s: symbols.symbol, terakhir: sql<string | null>`max(${reportDates.reportDate})` })
    .from(symbols)
    .leftJoin(reportDates, eq(reportDates.symbol, symbols.symbol))
    .groupBy(symbols.symbol)
    .orderBy(sql`max(${reportDates.reportDate}) asc nulls first`, symbols.symbol);
  const lewati = new Set(DIKETAHUI_404.dates);
  return rows.map((r) => r.s).filter((s) => !lewati.has(s));
}

/**
 * Penjaga anggaran run ini. Tidak mengganti pagar cadangan di provider
 * (CreditReserveError); ini batas kedua yang dipilih manusia per run.
 */
class Anggaran {
  terpakai = 0;
  constructor(
    readonly maks: number,
    readonly dry: boolean,
  ) {}
  bolehPanggil(): boolean {
    return this.dry || this.terpakai < this.maks;
  }
  pakai(kredit: number): void {
    this.terpakai += kredit;
  }
}

async function langkahSuspensi(db: Db, provider: SectorsProvider, anggaran: Anggaran, today: string): Promise<void> {
  const sebelum = await tanggalSuspensiTerbaru(db);
  console.log(`\n[suspensi] baris terbaru di database: ${sebelum ?? "(kosong)"}; menarik sampai ${today}`);
  if (anggaran.dry) {
    console.log(`  --dry: sampai ${MAKS_HALAMAN_SUSPENSI} halaman × 1 kredit, berhenti setelah ${HALAMAN_TANPA_BARU_MAKS} halaman tanpa baris baru`);
    return;
  }
  let offset = 0;
  let baru = 0;
  let halamanTanpaBaru = 0;
  for (let i = 0; i < MAKS_HALAMAN_SUSPENSI; i += 1) {
    if (!anggaran.bolehPanggil()) {
      console.log(`  berhenti: batas kredit run (${anggaran.maks}) tercapai`);
      return;
    }
    const page = await coba(() => provider.suspensions({ end: today, limit: LIMIT_SUSPENSI, offset }), `suspensi offset=${offset}`);
    anggaran.pakai(1);
    if (page.results.length === 0) break;
    const ditulis = await db
      .insert(suspensions)
      .values(
        page.results.map((r) => ({
          symbol: r.symbol,
          suspensionDate: r.suspension_date,
          reason: r.reason ?? null,
          pdfUrl: r.pdf_url ?? null,
        })),
      )
      .onConflictDoNothing()
      .returning({ s: suspensions.symbol });
    baru += ditulis.length;
    halamanTanpaBaru = ditulis.length === 0 ? halamanTanpaBaru + 1 : 0;
    console.log(`  halaman offset=${offset}: ${page.results.length} baris, ${ditulis.length} baru`);
    // Feed terurut dari yang terbaru: begitu dua halaman berturut-turut tidak
    // membawa baris baru, sisanya sudah ada di database.
    if (halamanTanpaBaru >= HALAMAN_TANPA_BARU_MAKS) {
      console.log("  berhenti: dua halaman tanpa baris baru");
      break;
    }
    if (!page.pagination?.has_next) break;
    offset = page.pagination.next_offset ?? offset + LIMIT_SUSPENSI;
  }
  console.log(`[suspensi] selesai: ${baru} baris baru`);
}

async function langkahDates(db: Db, provider: SectorsProvider, anggaran: Anggaran): Promise<void> {
  const daftar = await simbolUniverse(db);
  console.log(`\n[dates] ${daftar.length} emiten (tanpa ${DIKETAHUI_404.dates.length} yang diketahui 404); kuartal terbaru di database: ${(await kuartalTerbaru(db)) ?? "(kosong)"}`);
  if (anggaran.dry) {
    console.log(`  --dry: ${daftar.length} panggilan × 1 kredit; cache permanen tiap emiten dihapus lebih dulu agar kuartal baru benar-benar ditarik`);
    return;
  }
  let baru = 0;
  let dipanggil = 0;
  for (const symbol of daftar) {
    if (!anggaran.bolehPanggil()) {
      console.log(`  berhenti di ${symbol}: batas kredit run (${anggaran.maks}) tercapai`);
      break;
    }
    // Cache daftar kuartal permanen (data historis), jadi harus dibuang dulu.
    await db.delete(apiCache).where(eq(apiCache.endpoint, `/v2/company/get_quarterly_financial_dates/${symbol}/`));
    const dates = await coba(() => provider.quarterlyFinancialDates(symbol), symbol);
    anggaran.pakai(1);
    dipanggil += 1;
    // Sectors membatasi laju: tanpa jeda, run 99 emiten kena 429 di tengah jalan.
    await tidur(JEDA_ANTAR_PANGGILAN_MS);
    const rows = barisReportDates(symbol, dates);
    if (rows.length === 0) continue;
    const ditulis = await db.insert(reportDates).values(rows).onConflictDoNothing().returning({ s: reportDates.symbol });
    if (ditulis.length) console.log(`  ${symbol}: ${ditulis.length} kuartal baru`);
    baru += ditulis.length;
  }
  console.log(`[dates] selesai: ${dipanggil} emiten dipanggil, ${baru} kuartal baru`);
}

async function main(): Promise<number> {
  const arg = urai(process.argv.slice(2));
  if (arg.help) {
    console.log(bantuan());
    return 0;
  }
  if (!Number.isFinite(arg.maks) || arg.maks <= 0) {
    console.error(`--maks harus angka > 0 (diberikan: ${arg.maks})`);
    return 1;
  }
  const terbuka = await bukaDb({ pgliteDir: arg.pgliteDir });
  const db = terbuka.db;
  try {
    const today = hariIni();
    const provider = arg.dry
      ? null
      : sectorsProviderDariEnv(process.env, { ledger: new LedgerDb(db), cache: new CacheDb(db) });
    if (!arg.dry && !provider) {
      console.error("SECTORS_API_KEY kosong: tidak ada yang bisa disegarkan. Jalankan dengan --dry untuk melihat rencananya.");
      return 1;
    }
    const sebelum = await kreditTerpakai(db);
    const sisaAwal = provider ? await provider.sisaKredit() : null;
    console.log(`Sumber   : ${terbuka.keterangan}`);
    console.log(`Kredit   : terpakai seumur proyek ${sebelum}${sisaAwal !== null ? `, sisa menurut ledger ${sisaAwal}` : ""}; batas run ini ${arg.maks}`);
    console.log(`Langkah  : ${arg.hanya.join(", ")}${arg.dry ? " (--dry: tanpa panggilan API)" : ""}`);

    const anggaran = new Anggaran(arg.maks, arg.dry);
    try {
      if (arg.hanya.includes("suspensi")) await langkahSuspensi(db, provider as SectorsProvider, anggaran, today);
      if (arg.hanya.includes("dates")) await langkahDates(db, provider as SectorsProvider, anggaran);
    } catch (err) {
      if (err instanceof CreditReserveError) {
        console.error(`\nBerhenti: cadangan kredit tercapai (${err.message}). Data yang sudah ditulis tetap tersimpan.`);
      } else {
        throw err;
      }
    }

    const sesudah = await kreditTerpakai(db);
    console.log(`\nKredit run ini: ${sesudah - sebelum} (terpakai seumur proyek ${sesudah}${provider ? `, sisa ${await provider.sisaKredit()}` : ""})`);
    return 0;
  } finally {
    await terbuka.tutup();
  }
}

main()
  .then((kode) => {
    process.exitCode = kode;
  })
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
