// Sinkronisasi isi DB antar penyimpan (PGlite lokal → Neon, atau sebaliknya)
// TANPA memanggil API Sectors: yang disalin adalah baris tabel data kelas A
// (symbols, suspensions, report_dates, corporate_actions, filings, financials_q)
// plus buku kredit & cache (api_ledger, api_cache). Idempoten: menjalankan dua
// kali menghasilkan jumlah baris yang sama.
//
// Strategi per tabel:
// - Kunci alami unik (symbols.symbol; suspensions (symbol,date); report_dates
//   (symbol,year,quarter); financials_q (symbol,date)) → upsert batch.
// - Tanpa kunci alami (corporate_actions, filings; bisa ada dua baris identik
//   yang sah) → per emiten: hapus baris emiten itu di tujuan lalu sisipkan ulang,
//   sama seperti yang dilakukan pull-universe. Emiten yang tidak ada di sumber
//   tidak disentuh.
// - api_ledger/api_cache → `migrasiKeDb` (dedup ts+endpoint+params+status+credits).
// Kolom `id` (serial) sengaja tidak disalin agar tidak bertabrakan.
import { asc, count, inArray, sql } from "drizzle-orm";

import { migrasiKeDb, sumberDariDb, type HasilMigrasi } from "../data/migrasi-cache";
import { DIR_PGLITE_DEFAULT } from "./buka";
import type { Db } from "./client";
import {
  apiCache,
  apiLedger,
  corporateActions,
  filings,
  financialsQ,
  reportDates,
  suspensions,
  symbols,
} from "./schema";

export const TABEL_SINKRON = [
  "symbols",
  "suspensions",
  "report_dates",
  "corporate_actions",
  "filings",
  "financials_q",
  "api_ledger",
  "api_cache",
] as const;
export type TabelSinkron = (typeof TABEL_SINKRON)[number];

export interface HitungTabel {
  sumber: number;
  tujuan: number;
}

export interface HasilSinkron {
  baris: Record<TabelSinkron, HitungTabel>;
  /** true bila SEMUA tabel berjumlah sama di sumber dan tujuan setelah sinkron. */
  sama: boolean;
  ledger: HasilMigrasi;
}

export interface OpsiSinkron {
  /** Baris per pernyataan INSERT (Neon HTTP: satu permintaan per pernyataan). Default 200. */
  ukuranBatch?: number;
  log?: (pesan: string) => void;
}

const TABEL = {
  symbols,
  suspensions,
  report_dates: reportDates,
  corporate_actions: corporateActions,
  filings,
  financials_q: financialsQ,
  api_ledger: apiLedger,
  api_cache: apiCache,
} as const;

function potong<T>(arr: readonly T[], n: number): T[][] {
  const hasil: T[][] = [];
  for (let i = 0; i < arr.length; i += n) hasil.push(arr.slice(i, i + n));
  return hasil;
}

export async function hitungBarisTabel(db: Db): Promise<Record<TabelSinkron, number>> {
  const hasil = {} as Record<TabelSinkron, number>;
  for (const nama of TABEL_SINKRON) {
    const [r] = await db.select({ n: count() }).from(TABEL[nama]);
    hasil[nama] = Number(r?.n ?? 0);
  }
  return hasil;
}

export async function sinkronDb(sumber: Db, tujuan: Db, opsi: OpsiSinkron = {}): Promise<HasilSinkron> {
  const batch = opsi.ukuranBatch ?? 200;
  const log = opsi.log ?? (() => {});

  // --- symbols (PK symbol) ---
  const daftarSimbol = await sumber.select().from(symbols).orderBy(asc(symbols.symbol));
  for (const p of potong(daftarSimbol, batch)) {
    await tujuan
      .insert(symbols)
      .values(p)
      .onConflictDoUpdate({
        target: symbols.symbol,
        set: {
          companyName: sql`excluded.company_name`,
          subSector: sql`excluded.sub_sector`,
          group: sql`excluded."group"`,
          targetEventDate: sql`excluded.target_event_date`,
          notes: sql`excluded.notes`,
        },
      });
  }
  log(`symbols: ${daftarSimbol.length} baris di-upsert`);

  // --- suspensions (symbol, suspension_date) ---
  const daftarSuspensi = await sumber
    .select({ symbol: suspensions.symbol, suspensionDate: suspensions.suspensionDate, reason: suspensions.reason, pdfUrl: suspensions.pdfUrl })
    .from(suspensions)
    .orderBy(asc(suspensions.id));
  for (const p of potong(daftarSuspensi, batch)) {
    await tujuan
      .insert(suspensions)
      .values(p)
      .onConflictDoUpdate({
        target: [suspensions.symbol, suspensions.suspensionDate],
        set: { reason: sql`excluded.reason`, pdfUrl: sql`excluded.pdf_url` },
      });
  }
  log(`suspensions: ${daftarSuspensi.length} baris di-upsert`);

  // --- report_dates (symbol, fiscal_year, quarter) ---
  const daftarDates = await sumber
    .select({ symbol: reportDates.symbol, reportDate: reportDates.reportDate, quarter: reportDates.quarter, fiscalYear: reportDates.fiscalYear })
    .from(reportDates)
    .orderBy(asc(reportDates.id));
  for (const p of potong(daftarDates, batch)) {
    await tujuan
      .insert(reportDates)
      .values(p)
      .onConflictDoUpdate({
        target: [reportDates.symbol, reportDates.fiscalYear, reportDates.quarter],
        set: { reportDate: sql`excluded.report_date` },
      });
  }
  log(`report_dates: ${daftarDates.length} baris di-upsert`);

  // --- financials_q (symbol, report_date) ---
  const daftarFin = await sumber
    .select({
      symbol: financialsQ.symbol,
      reportDate: financialsQ.reportDate,
      totalEquity: financialsQ.totalEquity,
      totalLiabilities: financialsQ.totalLiabilities,
      totalAssets: financialsQ.totalAssets,
      earnings: financialsQ.earnings,
      revenue: financialsQ.revenue,
      payload: financialsQ.payload,
    })
    .from(financialsQ)
    .orderBy(asc(financialsQ.id));
  for (const p of potong(daftarFin, batch)) {
    await tujuan
      .insert(financialsQ)
      .values(p)
      .onConflictDoUpdate({
        target: [financialsQ.symbol, financialsQ.reportDate],
        set: {
          totalEquity: sql`excluded.total_equity`,
          totalLiabilities: sql`excluded.total_liabilities`,
          totalAssets: sql`excluded.total_assets`,
          earnings: sql`excluded.earnings`,
          revenue: sql`excluded.revenue`,
          payload: sql`excluded.payload`,
        },
      });
  }
  log(`financials_q: ${daftarFin.length} baris di-upsert`);

  // --- corporate_actions & filings: ganti per emiten ---
  const daftarAksi = await sumber
    .select({ symbol: corporateActions.symbol, kind: corporateActions.kind, eventDate: corporateActions.eventDate, payload: corporateActions.payload })
    .from(corporateActions)
    .orderBy(asc(corporateActions.id));
  await gantiPerEmiten(tujuan, corporateActions, daftarAksi, batch);
  log(`corporate_actions: ${daftarAksi.length} baris diganti per emiten`);

  const daftarFiling = await sumber
    .select({
      symbol: filings.symbol,
      timestamp: filings.timestamp,
      holderName: filings.holderName,
      holderType: filings.holderType,
      transactionType: filings.transactionType,
      amountTransaction: filings.amountTransaction,
      price: filings.price,
      transactionValue: filings.transactionValue,
      sharePctBefore: filings.sharePctBefore,
      sharePctAfter: filings.sharePctAfter,
      source: filings.source,
    })
    .from(filings)
    .orderBy(asc(filings.id));
  await gantiPerEmiten(tujuan, filings, daftarFiling, batch);
  log(`filings: ${daftarFiling.length} baris diganti per emiten`);

  // --- api_ledger & api_cache ---
  const ledger = await migrasiKeDb(await sumberDariDb(sumber), tujuan);
  log(`api_ledger: +${ledger.ledgerDisisipkan} (lewati ${ledger.ledgerDilewati}); api_cache: +${ledger.cacheDisisipkan} (lewati ${ledger.cacheDilewati})`);

  const [diSumber, diTujuan] = await Promise.all([hitungBarisTabel(sumber), hitungBarisTabel(tujuan)]);
  const baris = {} as Record<TabelSinkron, HitungTabel>;
  for (const nama of TABEL_SINKRON) baris[nama] = { sumber: diSumber[nama], tujuan: diTujuan[nama] };
  return { baris, sama: TABEL_SINKRON.every((n) => baris[n].sumber === baris[n].tujuan), ledger };
}

/** Hapus semua baris emiten yang ada di `rows` pada tujuan, lalu sisipkan ulang `rows`. */
async function gantiPerEmiten<R extends { symbol: string }>(
  tujuan: Db,
  tabel: typeof corporateActions | typeof filings,
  rows: readonly R[],
  batch: number,
): Promise<void> {
  const simbol = [...new Set(rows.map((r) => r.symbol))];
  for (const p of potong(simbol, 50)) await tujuan.delete(tabel).where(inArray(tabel.symbol, p));
  for (const p of potong(rows, batch)) {
    // Kedua tabel berbagi bentuk `symbol` + kolom spesifik; tipe baris sudah dijamin pemanggil.
    await tujuan.insert(tabel).values(p as unknown as (typeof tabel.$inferInsert)[]);
  }
}

// ---------- Argumen skrip db:sync ----------

export interface TargetDb {
  jenis: "pglite" | "neon";
  /** Folder PGlite (hanya jenis pglite). */
  dir?: string;
}

/**
 * `pglite` | `pglite:DIR` | `neon` (= DATABASE_URL, Neon atau Postgres apa pun).
 * Dilempar bila bentuknya tidak dikenal.
 */
export function uraiTarget(teks: string, dirDefault: string = DIR_PGLITE_DEFAULT): TargetDb {
  const t = teks.trim();
  if (t === "neon" || t === "db") return { jenis: "neon" };
  if (t === "pglite") return { jenis: "pglite", dir: dirDefault };
  if (t.startsWith("pglite:")) {
    const dir = t.slice("pglite:".length).trim();
    return { jenis: "pglite", dir: dir || dirDefault };
  }
  throw new Error(`Target DB tidak dikenal: "${teks}" (pilihan: pglite, pglite:DIR, neon)`);
}
