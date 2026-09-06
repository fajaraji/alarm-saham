// Kejadian ternormalisasi per emiten + dua sumber: fixture JSON dan DB Drizzle.
//
// Sumber TIDAK memfilter menurut tanggal: semua baris per simbol dikembalikan,
// dan pemotongan "hanya data bertanggal <= t" dilakukan oleh mesin (evaluate.ts).
// Dengan begitu satu objek kejadian bisa dipakai ulang untuk banyak t.
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "../db/client";
import {
  corporateActions,
  filings,
  financialsQ,
  reportDates,
  suspensions,
  symbols,
} from "../db/schema";
import { pastikanTanggal } from "./dates";

// ---------------------------------------------------------------------------
// Tipe kejadian
// ---------------------------------------------------------------------------

export interface KejadianSuspensi {
  date: string;
  reason: string | null;
}

/** Satu kuartal yang laporannya TERSEDIA (bukan tanggal penyampaian). */
export interface KuartalTersedia {
  /** Akhir periode, mis. "2024-09-30". */
  periodEnd: string;
  quarter: string;
  fiscalYear: number;
}

export interface RightIssue {
  exDate: string;
  newRatio: number | null;
  oldRatio: number | null;
}

export interface KeuanganKuartal {
  date: string;
  totalEquity: number | null;
}

export interface FilingRingkas {
  /** Tanggal (YYYY-MM-DD) dari timestamp filing. */
  date: string;
  holderType: string | null;
  transactionType: string | null;
  sharePctBefore: number | null;
  sharePctAfter: number | null;
}

export interface EmitenEvents {
  symbol: string;
  suspensions: KejadianSuspensi[];
  quarters: KuartalTersedia[];
  rightIssues: RightIssue[];
  financials: KeuanganKuartal[];
  filings: FilingRingkas[];
}

export interface EventSource {
  readonly name: string;
  /** Semua kejadian satu emiten, terurut naik menurut tanggal. Emiten tanpa data → daftar kosong. */
  events(symbol: string): Promise<EmitenEvents>;
}

export type Group = "delisting" | "watchlist" | "control";
export const GROUPS = ["delisting", "watchlist", "control"] as const;

export interface UniverseEntry {
  symbol: string;
  group: Group;
  /** Wajib untuk delisting/watchlist; null/absen untuk kontrol. */
  targetEventDate?: string | null;
}

// ---------------------------------------------------------------------------
// Bantu tanggal/timestamp
// ---------------------------------------------------------------------------

/**
 * Timestamp filing → Date UTC. Sectors mengirim "2026-01-09T00:00:00" tanpa
 * zona; kami memperlakukannya sebagai UTC agar tanggal kalendernya tidak
 * bergeser menurut zona waktu mesin. Pakai ini juga saat memasukkan ke DB.
 */
export function keDateUtc(ts: string): Date {
  const punyaZona = /(Z|[+-]\d{2}:?\d{2})$/i.test(ts);
  const d = new Date(punyaZona ? ts : `${ts}Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`timestamp tidak sah: "${ts}"`);
  return d;
}

export function tanggalDariTimestamp(ts: string | Date): string {
  const d = ts instanceof Date ? ts : keDateUtc(ts);
  return d.toISOString().slice(0, 10);
}

function urutMenurut<T>(k: { [K in keyof T]: T[K] extends string ? K : never }[keyof T]) {
  return (a: T, b: T) => String(a[k]).localeCompare(String(b[k]));
}

function urutkan(e: EmitenEvents): EmitenEvents {
  return {
    symbol: e.symbol,
    suspensions: [...e.suspensions].sort(urutMenurut<KejadianSuspensi>("date")),
    quarters: [...e.quarters].sort(urutMenurut<KuartalTersedia>("periodEnd")),
    rightIssues: [...e.rightIssues].sort(urutMenurut<RightIssue>("exDate")),
    financials: [...e.financials].sort(urutMenurut<KeuanganKuartal>("date")),
    filings: [...e.filings].sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.holderType ?? "").localeCompare(b.holderType ?? "") ||
        (a.sharePctBefore ?? 0) - (b.sharePctBefore ?? 0),
    ),
  };
}

export function kosong(symbol: string): EmitenEvents {
  return { symbol, suspensions: [], quarters: [], rightIssues: [], financials: [], filings: [] };
}

// ---------------------------------------------------------------------------
// Sumber 1: fixture JSON (bentuk mengikuti respons Sectors v2, lihat data/types.ts)
// ---------------------------------------------------------------------------

const angka = z.number().nullable().optional();
const teks = z.string().nullable().optional();
const tanggal = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "tanggal harus YYYY-MM-DD" });

const FixtureEmitenSchema = z.looseObject({
  suspensions: z
    .array(z.looseObject({ suspension_date: tanggal, reason: teks }))
    .optional()
    .default([]),
  /** dict tahun → [[akhir_periode, "q1".."q4"], ...] */
  quarterly_financial_dates: z
    .record(z.string(), z.array(z.tuple([tanggal, z.string()])))
    .optional()
    .default({}),
  right_issue: z
    .array(z.looseObject({ ex_date: tanggal, new_ratio: angka, old_ratio: angka }))
    .optional()
    .default([]),
  quarterly_financials: z
    .array(z.looseObject({ date: tanggal, total_equity: angka }))
    .optional()
    .default([]),
  filings: z
    .array(
      z.looseObject({
        timestamp: z.string(),
        holder_type: teks,
        transaction_type: teks,
        share_percentage_before: angka,
        share_percentage_after: angka,
      }),
    )
    .optional()
    .default([]),
});
export type FixtureEmiten = z.input<typeof FixtureEmitenSchema>;

export const UniverseEntrySchema = z.looseObject({
  symbol: z.string().trim().toUpperCase(),
  group: z.enum(GROUPS, { error: "group harus 'delisting', 'watchlist', atau 'control'" }),
  targetEventDate: tanggal.nullable().optional(),
});

export const UniverseFixtureSchema = z.looseObject({
  universe: z.array(UniverseEntrySchema),
  emiten: z.record(z.string(), FixtureEmitenSchema),
});
export type UniverseFixture = z.input<typeof UniverseFixtureSchema>;

/** Sumber kejadian dari fixture JSON (divalidasi Zod saat dibuat). */
export function fromFixture(json: unknown): EventSource & { universe: UniverseEntry[] } {
  const f = UniverseFixtureSchema.parse(json);
  const universe: UniverseEntry[] = f.universe.map((u) => ({
    symbol: u.symbol,
    group: u.group,
    targetEventDate: u.targetEventDate ?? null,
  }));
  return {
    name: "fixture",
    universe,
    async events(symbol) {
      const s = symbol.trim().toUpperCase();
      const e = f.emiten[s];
      if (!e) return kosong(s);
      const quarters: KuartalTersedia[] = [];
      for (const [tahun, daftar] of Object.entries(e.quarterly_financial_dates)) {
        for (const [periodEnd, quarter] of daftar) {
          quarters.push({ periodEnd, quarter, fiscalYear: Number(tahun) });
        }
      }
      return urutkan({
        symbol: s,
        suspensions: e.suspensions.map((x) => ({ date: x.suspension_date, reason: x.reason ?? null })),
        quarters,
        rightIssues: e.right_issue.map((r) => ({
          exDate: r.ex_date,
          newRatio: r.new_ratio ?? null,
          oldRatio: r.old_ratio ?? null,
        })),
        financials: e.quarterly_financials.map((q) => ({
          date: q.date,
          totalEquity: q.total_equity ?? null,
        })),
        filings: e.filings.map((x) => ({
          date: tanggalDariTimestamp(x.timestamp),
          holderType: x.holder_type ?? null,
          transactionType: x.transaction_type ?? null,
          sharePctBefore: x.share_percentage_before ?? null,
          sharePctAfter: x.share_percentage_after ?? null,
        })),
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Sumber 2: DB Drizzle (tabel tiket 05)
// ---------------------------------------------------------------------------

function angkaPayload(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** Sumber kejadian dari DB: satu kueri per tabel per simbol, semua baris. */
export function fromDb(db: Db): EventSource {
  return {
    name: "db",
    async events(symbol) {
      const s = symbol.trim().toUpperCase();
      const [susp, kuartal, aksi, keu, fil] = await Promise.all([
        db
          .select({ date: suspensions.suspensionDate, reason: suspensions.reason })
          .from(suspensions)
          .where(eq(suspensions.symbol, s))
          .orderBy(asc(suspensions.suspensionDate)),
        db
          .select({
            periodEnd: reportDates.reportDate,
            quarter: reportDates.quarter,
            fiscalYear: reportDates.fiscalYear,
          })
          .from(reportDates)
          .where(eq(reportDates.symbol, s))
          .orderBy(asc(reportDates.reportDate)),
        db
          .select({
            kind: corporateActions.kind,
            eventDate: corporateActions.eventDate,
            payload: corporateActions.payload,
          })
          .from(corporateActions)
          .where(eq(corporateActions.symbol, s))
          .orderBy(asc(corporateActions.eventDate)),
        db
          .select({ date: financialsQ.reportDate, totalEquity: financialsQ.totalEquity })
          .from(financialsQ)
          .where(eq(financialsQ.symbol, s))
          .orderBy(asc(financialsQ.reportDate)),
        db
          .select({
            timestamp: filings.timestamp,
            holderType: filings.holderType,
            transactionType: filings.transactionType,
            sharePctBefore: filings.sharePctBefore,
            sharePctAfter: filings.sharePctAfter,
          })
          .from(filings)
          .where(eq(filings.symbol, s))
          .orderBy(asc(filings.timestamp)),
      ]);
      // Hanya right_issue yang dilutif menurut keputusan tiket 04; filter di
      // sini (bukan di SQL) agar bentuk kueri per tabel seragam.
      return urutkan({
        symbol: s,
        suspensions: susp.map((r) => ({ date: r.date, reason: r.reason ?? null })),
        quarters: kuartal,
        rightIssues: aksi
          .filter((r) => r.kind === "right_issue")
          .map((r) => ({
            exDate: r.eventDate,
            newRatio: angkaPayload(r.payload.new_ratio),
            oldRatio: angkaPayload(r.payload.old_ratio),
          })),
        financials: keu.map((r) => ({ date: r.date, totalEquity: r.totalEquity ?? null })),
        filings: fil.map((r) => ({
          date: tanggalDariTimestamp(r.timestamp),
          holderType: r.holderType ?? null,
          transactionType: r.transactionType ?? null,
          sharePctBefore: r.sharePctBefore ?? null,
          sharePctAfter: r.sharePctAfter ?? null,
        })),
      });
    },
  };
}

/** Universe uji dari tabel `symbols`. */
export async function universeFromDb(db: Db): Promise<UniverseEntry[]> {
  const rows = await db
    .select({ symbol: symbols.symbol, group: symbols.group, targetEventDate: symbols.targetEventDate })
    .from(symbols)
    .orderBy(asc(symbols.symbol));
  return rows.map((r) => ({
    symbol: r.symbol,
    group: r.group,
    targetEventDate: r.targetEventDate ? pastikanTanggal("target_event_date", r.targetEventDate) : null,
  }));
}
