import { z } from "zod";

// Skema respons Sectors API v2 (IDX). Sengaja LONGGAR: semua objek memakai
// `looseObject` sehingga field yang tidak dikenal dibiarkan lewat, dan field
// yang tidak kita andalkan dibuat opsional/nullable.
//
// Bentuk di bawah ini DIVERIFIKASI terhadap respons nyata pada tiket 04
// (docs/data-proof.md, 7 Sep 2026); sampel tersamar ada di tests/unit/data/samples/.
// Perbedaan dari dokumentasi/asumsi tiket 03 yang dikoreksi di sini:
// - `symbol` selalu berakhiran ".JK" (mis. "SRIL.JK") → dinormalisasi ke 4 huruf.
// - get_quarterly_financial_dates: dict tahun → [[akhir_periode, "q1".."q4"], ...]
//   (BUKAN [report_date, q1..q4]); hanya kuartal yang laporannya tersedia; mulai 2020.
// - financials/quarterly: tanggal ada di `date` (bukan `report_date`); urutan turun.
// - corporate-actions: terbungkus `{symbol, corporate_actions:{...}}`; daftar kosong = null.
// - broker-summary: `{symbol,start,end,data:[{date,summary:[baris per broker]}]}`.
// - filings: persentase saham dalam satuan PERSEN (0.91 = 0,91 %); ada title/body/tags.
// - listing-performance: hanya chg_7d/30d/90d/365d (tanpa listing_date/offering_price).

const angka = z.number().nullable().optional();
const teks = z.string().nullable().optional();

/** Simbol IDX dari API ("SRIL.JK") → "SRIL". */
export const SimbolSchema = z
  .string()
  .transform((s) => s.trim().toUpperCase().replace(/\.JK$/, ""));

/** Array yang boleh null/absen di API → selalu array. */
const daftar = <T extends z.ZodType>(item: T) =>
  z
    .array(item)
    .nullable()
    .optional()
    .transform((v) => v ?? []);

// ---------- Envelope feed berpaginasi (suspensions, filings) ----------

export const PaginationSchema = z.looseObject({
  total_count: z.number().optional(),
  showing: z.number().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  has_next: z.boolean().optional(),
  has_previous: z.boolean().optional(),
  next_offset: z.number().nullable().optional(),
  previous_offset: z.number().nullable().optional(),
});
export type Pagination = z.infer<typeof PaginationSchema>;

export function pageOf<T extends z.ZodType>(item: T) {
  return z.looseObject({
    results: z.array(item),
    pagination: PaginationSchema.optional(),
  });
}
export interface Page<T> {
  results: T[];
  pagination?: Pagination;
}

// ---------- Kelas A: bisa diuji ke masa lalu ----------

export const SuspensionSchema = z.looseObject({
  symbol: SimbolSchema,
  suspension_date: z.string(),
  reason: teks,
  pdf_url: teks,
});
export type Suspension = z.infer<typeof SuspensionSchema>;
export const SuspensionsPageSchema = pageOf(SuspensionSchema);

/** Satu kuartal yang laporannya tersedia: [tanggal akhir periode, "q1".."q4"]. */
export const KuartalTersediaSchema = z.tuple([z.string(), z.string()]);
export type KuartalTersedia = z.infer<typeof KuartalTersediaSchema>;
/** dict tahun → daftar kuartal tersedia. Kuartal yang belum/tidak dilaporkan TIDAK muncul. */
export const QuarterlyFinancialDatesSchema = z.record(z.string(), z.array(KuartalTersediaSchema));
export type QuarterlyFinancialDates = z.infer<typeof QuarterlyFinancialDatesSchema>;

export const FilingSchema = z.looseObject({
  symbol: SimbolSchema.optional(),
  title: teks,
  body: teks,
  holder_name: teks,
  holder_type: teks, // insider | institution | corporate-investor
  transaction_type: teks, // buy | sell | others
  holding_before: angka,
  holding_after: angka,
  amount_transaction: angka,
  price: angka,
  transaction_value: angka,
  /** Dalam persen: 0.91 = 0,91 % saham beredar. */
  share_percentage_before: angka,
  share_percentage_after: angka,
  share_percentage_transaction: angka,
  tags: z.array(z.string()).nullable().optional(),
  sector: teks,
  sub_sector: teks,
  source: teks,
  timestamp: z.string(),
});
export type Filing = z.infer<typeof FilingSchema>;
export const FilingsPageSchema = pageOf(FilingSchema);

export const DividendSchema = z.looseObject({
  ex_date: teks,
  payment_date: teks,
  dividend_amount: angka,
  dividend_yield: angka,
});
export const RightIssueSchema = z.looseObject({
  ex_date: teks,
  price: angka,
  /** Rasio: setiap `old_ratio` saham lama berhak `new_ratio` saham baru. */
  new_ratio: angka,
  old_ratio: angka,
  trading_period_start: teks,
  trading_period_end: teks,
});
export const AgmSchema = z.looseObject({
  agm_date: teks,
  agm_time: teks,
  agm_place: teks,
  agm_result: z.unknown().optional(),
});
const isiAksi = {
  dividend: daftar(DividendSchema),
  upcoming_dividend: daftar(z.looseObject({})),
  stock_split: daftar(z.looseObject({})),
  right_issue: daftar(RightIssueSchema),
  warrant: daftar(z.looseObject({})),
  bonus: daftar(z.looseObject({})),
  agm: daftar(AgmSchema),
};
/** API membungkus daftar aksi di `corporate_actions`; ratakan agar bentuk seragam. */
function ratakanAksi(raw: unknown): unknown {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const { corporate_actions, ...sisa } = raw as Record<string, unknown>;
    if (corporate_actions && typeof corporate_actions === "object") {
      return { ...sisa, ...(corporate_actions as Record<string, unknown>) };
    }
  }
  return raw;
}
export const CorporateActionsSchema = z.preprocess(
  ratakanAksi,
  z.looseObject({ symbol: SimbolSchema.optional(), ...isiAksi }),
);
export type CorporateActions = z.infer<typeof CorporateActionsSchema>;

export const QuarterlyFinancialSchema = z
  .looseObject({
    symbol: SimbolSchema.optional(),
    /** Akhir periode kuartal (API v2). */
    date: teks,
    /** Alias `date`; selalu terisi setelah parse. */
    report_date: teks,
    revenue: angka,
    gross_profit: angka,
    operating_pnl: angka,
    earnings_before_tax: angka,
    earnings: angka,
    ebit: angka,
    ebitda: angka,
    total_assets: angka,
    total_equity: angka,
    stockholders_equity: angka,
    total_liabilities: angka,
    total_debt: angka,
    current_liabilities: angka,
    cash_and_short_term_investments: angka,
    operating_cash_flow: angka,
    investing_cash_flow: angka,
    financing_cash_flow: angka,
    net_cash_flow: angka,
    free_cash_flow: angka,
  })
  .transform((o, ctx) => {
    const report_date = o.report_date ?? o.date;
    if (!report_date) {
      ctx.addIssue({ code: "custom", message: "report_date/date tidak ada" });
      return z.NEVER;
    }
    return { ...o, report_date };
  });
export type QuarterlyFinancial = z.infer<typeof QuarterlyFinancialSchema>;
/** API mengembalikan urutan turun; dinormalisasi NAIK menurut report_date. */
export const QuarterlyFinancialsSchema = z
  .array(QuarterlyFinancialSchema)
  .transform((arr) => [...arr].sort((a, b) => a.report_date.localeCompare(b.report_date)));

// ---------- Kelas B: hanya mode pasang ----------

export const FreeFloatEntrySchema = z.looseObject({
  symbol: SimbolSchema,
  company_name: teks,
  free_float: angka, // desimal, mis. 0.12 = 12 %; 1 = 100 %
});
export type FreeFloatEntry = z.infer<typeof FreeFloatEntrySchema>;
export const FreeFloatSchema = z.array(FreeFloatEntrySchema);

export const BrokerSummaryRowSchema = z.looseObject({
  broker_code: z.string(),
  bfreq: angka,
  blot: angka,
  bval: angka,
  bavg_per_share: angka,
  sfreq: angka,
  slot: angka,
  sval: angka,
  savg_per_share: angka,
  nlot: angka,
  nval: angka,
  navg_per_share: angka,
});
export type BrokerSummaryRow = z.infer<typeof BrokerSummaryRowSchema>;
export const BrokerSummaryDaySchema = z.looseObject({
  date: z.string(),
  summary: daftar(BrokerSummaryRowSchema),
});
export type BrokerSummaryDay = z.infer<typeof BrokerSummaryDaySchema>;
export const BrokerSummarySchema = z.looseObject({
  symbol: SimbolSchema.optional(),
  start: teks,
  end: teks,
  /** Satu entri per hari bursa; kosong bila saham tersuspensi. */
  data: daftar(BrokerSummaryDaySchema),
});
export type BrokerSummary = z.infer<typeof BrokerSummarySchema>;

export const ListingPerformanceSchema = z.looseObject({
  symbol: SimbolSchema.optional(),
  listing_date: teks, // tidak ada pada respons nyata (Sep 2026)
  offering_price: angka, // idem
  chg_7d: angka,
  chg_30d: angka,
  chg_90d: angka,
  chg_365d: angka,
});
export type ListingPerformance = z.infer<typeof ListingPerformanceSchema>;

export const DailyBarSchema = z.looseObject({
  symbol: SimbolSchema.optional(),
  date: z.string(),
  close: angka,
  open: angka, // null saat tersuspensi
  high: angka,
  low: angka,
  volume: angka,
  market_cap: angka,
});
export type DailyBar = z.infer<typeof DailyBarSchema>;
export const DailySchema = z.array(DailyBarSchema);

// ---------- Parameter kueri ----------

export interface SuspensionsQuery {
  /** Kosong = seluruh bursa (universe). */
  symbol?: string;
  start?: string; // YYYY-MM-DD
  end?: string; // YYYY-MM-DD
  limit?: number; // maks 30
  offset?: number;
}

export interface FilingsFilter {
  start?: string;
  end?: string;
  transaction_type?: "buy" | "sell" | "others";
  holder_type?: "insider" | "institution" | "corporate-investor";
  limit?: number;
  offset?: number;
}
