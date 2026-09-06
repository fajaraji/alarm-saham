// Aturan murni (tanpa I/O) penarikan universe tiket 07: pemilihan kontrol,
// tanggal kejadian target, jumlah kuartal financials, dan pemetaan respons
// Sectors → baris tabel. Diuji di tests/unit/universe/aturan.test.ts.
import type {
  Company,
  CorporateActions,
  Filing,
  QuarterlyFinancial,
  QuarterlyFinancialDates,
} from "../data/types";
import type { corporateActions, filings, financialsQ, reportDates } from "../db/schema";

const HARI_MS = 86_400_000;

export function geserHari(tanggal: string, hari: number): string {
  return new Date(Date.parse(tanggal) + hari * HARI_MS).toISOString().slice(0, 10);
}

/** Jumlah halaman feed untuk `total` baris pada `limit` per halaman (minimal 1). */
export function jumlahHalaman(total: number, limit: number): number {
  return Math.max(1, Math.ceil(total / limit));
}

// ---------- Kontrol sehat ----------

export interface KontrolTerpilih {
  symbol: string;
  companyName: string | null;
  subSector: string | null;
  marketCap: number | null;
}

/**
 * Pilih `n` kontrol dari kandidat LQ45: buang yang pernah tersuspensi (feed
 * universe) atau ada di daftar pengecualian, urutkan market_cap turun (null di
 * belakang), lalu ambil `n` teratas. Bila TIDAK ADA kandidat yang membawa
 * market_cap (screener default hanya symbol+company_name), urutan API dipertahankan
 * (pemanggil memakai `order_by=market_cap desc` di sisi server).
 */
export function pilihKontrol(
  kandidat: readonly Company[],
  pernahSuspensi: ReadonlySet<string>,
  kecuali: ReadonlySet<string>,
  n: number,
): KontrolTerpilih[] {
  const unik = new Map<string, Company>();
  for (const k of kandidat) if (!unik.has(k.symbol)) unik.set(k.symbol, k);
  const lolos = [...unik.values()].filter((k) => !pernahSuspensi.has(k.symbol) && !kecuali.has(k.symbol));
  const adaMarketCap = lolos.some((k) => k.market_cap != null);
  const urut = adaMarketCap
    ? [...lolos].sort((a, b) => (b.market_cap ?? -1) - (a.market_cap ?? -1) || a.symbol.localeCompare(b.symbol))
    : lolos;
  return urut
    .slice(0, n)
    .map((k) => ({
      symbol: k.symbol,
      companyName: k.company_name ?? null,
      subSector: k.sub_sector ?? null,
      marketCap: k.market_cap ?? null,
    }));
}

// ---------- Tanggal kejadian target ----------

/** Pemantauan khusus: suspensi TERAKHIR ≤ tanggal acuan; null bila tidak ada. */
export function targetPemantauan(tanggalSuspensi: readonly string[], acuan: string): string | null {
  let hasil: string | null = null;
  for (const t of tanggalSuspensi) if (t <= acuan && (hasil === null || t > hasil)) hasil = t;
  return hasil;
}

export interface TargetDelisting {
  tanggal: string;
  /** true = ada di feed suspensi dalam jendela [catatan − toleransi, ∞); false = memakai tanggal catatan. */
  terverifikasi: boolean;
}

/**
 * Delisting: suspensi TERAWAL di feed yang ≥ (tanggal catatan − `toleransiHari`);
 * bila tidak ada, pakai tanggal catatan (tidak terverifikasi).
 */
export function targetDelisting(
  tanggalSuspensi: readonly string[],
  tanggalCatatan: string,
  toleransiHari = 60,
): TargetDelisting {
  const batas = geserHari(tanggalCatatan, -toleransiHari);
  let terawal: string | null = null;
  for (const t of tanggalSuspensi) if (t >= batas && (terawal === null || t < terawal)) terawal = t;
  return terawal ? { tanggal: terawal, terverifikasi: true } : { tanggal: tanggalCatatan, terverifikasi: false };
}

// ---------- Financials: berapa kuartal yang layak dibayar ----------

/**
 * Jumlah kuartal tersedia dengan akhir periode ≥ `sejak`, dibatasi `maks`.
 * 0 = jangan panggil financials (tidak ada kuartal → kredit terbuang).
 */
export function nQuartersTersedia(dates: QuarterlyFinancialDates, sejak = "2020-01-01", maks = 8): number {
  let n = 0;
  for (const kuartal of Object.values(dates)) for (const [akhir] of kuartal) if (akhir >= sejak) n += 1;
  return Math.min(n, maks);
}

/**
 * Batas kuartal per emiten agar Σ min(n_i, batas) ≤ sisaKredit: mulai dari `maks`,
 * turunkan seragam (minimal 1). Dipakai pull-universe untuk memangkas financials.
 */
export function pasKuartal(tersedia: readonly number[], sisaKredit: number, maks: number): number {
  let m = maks;
  while (m > 1 && tersedia.reduce((a, n) => a + Math.min(n, m), 0) > sisaKredit) m -= 1;
  return m;
}

// ---------- Pemetaan respons → baris tabel ----------

type BarisReportDate = typeof reportDates.$inferInsert;
type BarisAksi = typeof corporateActions.$inferInsert;
type BarisFiling = typeof filings.$inferInsert;
type BarisFinancial = typeof financialsQ.$inferInsert;

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}/;
const tanggalSah = (v: unknown): string | null =>
  typeof v === "string" && POLA_TANGGAL.test(v) && !Number.isNaN(Date.parse(v.slice(0, 10))) ? v.slice(0, 10) : null;

export function barisReportDates(symbol: string, dates: QuarterlyFinancialDates): BarisReportDate[] {
  const hasil: BarisReportDate[] = [];
  for (const [tahun, kuartal] of Object.entries(dates)) {
    const fiscalYear = Number(tahun);
    if (!Number.isInteger(fiscalYear)) continue;
    for (const [akhir, q] of kuartal) {
      const reportDate = tanggalSah(akhir);
      if (!reportDate) continue;
      hasil.push({ symbol, reportDate, quarter: q, fiscalYear });
    }
  }
  return hasil;
}

/** Field tanggal kejadian per jenis aksi; yang pertama terisi dipakai. */
const FIELD_TANGGAL_AKSI: Record<string, readonly string[]> = {
  dividend: ["ex_date", "payment_date"],
  upcoming_dividend: ["ex_date", "payment_date"],
  right_issue: ["ex_date", "trading_period_start"],
  stock_split: ["ex_date", "date", "effective_date"],
  warrant: ["ex_date", "date", "listing_date"],
  bonus: ["ex_date", "date"],
  agm: ["agm_date"],
};

export function barisAksiKorporasi(symbol: string, aksi: CorporateActions): BarisAksi[] {
  const hasil: BarisAksi[] = [];
  for (const [jenis, fields] of Object.entries(FIELD_TANGGAL_AKSI)) {
    const daftar = (aksi as Record<string, unknown>)[jenis];
    if (!Array.isArray(daftar)) continue;
    const kind = (jenis === "upcoming_dividend" ? "dividend" : jenis) as BarisAksi["kind"];
    for (const item of daftar) {
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      let eventDate: string | null = null;
      for (const f of fields) if ((eventDate = tanggalSah(obj[f]))) break;
      if (!eventDate) continue;
      hasil.push({
        symbol,
        kind,
        eventDate,
        payload: { ...obj, ...(jenis === "upcoming_dividend" ? { upcoming: true } : {}) },
      });
    }
  }
  return hasil;
}

/** Timestamp Sectors tanpa zona ("2026-01-09T10:22:00") diperlakukan sebagai UTC agar tidak bergeser per mesin. */
export function parseTimestampUtc(ts: string): number {
  const naif = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(ts);
  return Date.parse(naif ? `${ts}Z` : ts);
}

export function barisFiling(symbol: string, f: Filing): BarisFiling | null {
  const ts = parseTimestampUtc(f.timestamp);
  if (Number.isNaN(ts)) return null;
  return {
    symbol,
    timestamp: new Date(ts),
    holderName: f.holder_name ?? null,
    holderType: f.holder_type ?? null,
    transactionType: f.transaction_type ?? null,
    amountTransaction: f.amount_transaction ?? null,
    price: f.price ?? null,
    transactionValue: f.transaction_value ?? null,
    sharePctBefore: f.share_percentage_before ?? null,
    sharePctAfter: f.share_percentage_after ?? null,
    source: f.source ?? null,
  };
}

export function barisFinancial(symbol: string, q: QuarterlyFinancial): BarisFinancial | null {
  const reportDate = tanggalSah(q.report_date);
  if (!reportDate) return null;
  return {
    symbol,
    reportDate,
    totalEquity: q.total_equity ?? null,
    totalLiabilities: q.total_liabilities ?? null,
    totalAssets: q.total_assets ?? null,
    earnings: q.earnings ?? null,
    revenue: q.revenue ?? null,
    payload: q as Record<string, unknown>,
  };
}
