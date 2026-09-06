import { z } from "zod";

// Skema respons Sectors API v2 (IDX). Sengaja LONGGAR: semua objek memakai
// `looseObject` sehingga field yang tidak dikenal dibiarkan lewat, dan field
// yang tidak kita andalkan dibuat opsional/nullable. Bentuk mengikuti
// dokumentasi docs.sectors.app; penyesuaian detail dilakukan di tiket 04
// setelah data nyata diamati.

const angka = z.number().nullable().optional();
const teks = z.string().nullable().optional();

// ---------- Envelope feed berpaginasi (suspensions, filings) ----------

export const PaginationSchema = z.looseObject({
  total_count: z.number().optional(),
  showing: z.number().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  has_next: z.boolean().optional(),
  next_offset: z.number().nullable().optional(),
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
  symbol: z.string(),
  suspension_date: z.string(),
  reason: teks,
  pdf_url: teks,
});
export type Suspension = z.infer<typeof SuspensionSchema>;
export const SuspensionsPageSchema = pageOf(SuspensionSchema);

// dict tahun -> [report_date, q1, q2, q3, q4]; kuartal yang belum dilaporkan = null.
export const QuarterlyFinancialDatesSchema = z.record(
  z.string(),
  z.array(z.string().nullable()),
);
export type QuarterlyFinancialDates = z.infer<typeof QuarterlyFinancialDatesSchema>;

export const FilingSchema = z.looseObject({
  symbol: z.string().optional(),
  holder_name: teks,
  holder_type: teks,
  transaction_type: teks,
  holding_before: angka,
  holding_after: angka,
  amount_transaction: angka,
  price: angka,
  transaction_value: angka,
  share_percentage_before: angka,
  share_percentage_after: angka,
  source: teks,
  timestamp: z.string(),
});
export type Filing = z.infer<typeof FilingSchema>;
export const FilingsPageSchema = pageOf(FilingSchema);

const daftarAksi = z.array(z.looseObject({})).optional();
export const CorporateActionsSchema = z.looseObject({
  symbol: z.string().optional(),
  dividend: daftarAksi,
  upcoming_dividend: daftarAksi,
  stock_split: daftarAksi,
  right_issue: daftarAksi,
  warrant: daftarAksi,
  bonus: daftarAksi,
  agm: daftarAksi,
});
export type CorporateActions = z.infer<typeof CorporateActionsSchema>;

export const QuarterlyFinancialSchema = z.looseObject({
  symbol: z.string().optional(),
  report_date: z.string(),
  revenue: angka,
  earnings: angka,
  total_assets: angka,
  total_equity: angka,
  total_liabilities: angka,
  total_debt: angka,
  operating_cash_flow: angka,
  investing_cash_flow: angka,
  financing_cash_flow: angka,
  ebit: angka,
  ebitda: angka,
});
export type QuarterlyFinancial = z.infer<typeof QuarterlyFinancialSchema>;
export const QuarterlyFinancialsSchema = z.array(QuarterlyFinancialSchema);

// ---------- Kelas B: hanya mode pasang ----------

export const FreeFloatEntrySchema = z.looseObject({
  symbol: z.string(),
  company_name: teks,
  free_float: angka, // desimal, mis. 0.12 = 12 %
});
export type FreeFloatEntry = z.infer<typeof FreeFloatEntrySchema>;
export const FreeFloatSchema = z.array(FreeFloatEntrySchema);

export const BrokerSummaryRowSchema = z.looseObject({
  date: teks,
  broker: teks,
  broker_code: teks,
  bfreq: angka,
  blot: angka,
  bval: angka,
  sfreq: angka,
  slot: angka,
  sval: angka,
  nlot: angka,
  nval: angka,
});
export type BrokerSummaryRow = z.infer<typeof BrokerSummaryRowSchema>;
// Bentuk pembungkus belum dipastikan dari dokumentasi: terima array baris
// maupun objek {symbol, results}.
export const BrokerSummarySchema = z.union([
  z.array(BrokerSummaryRowSchema),
  z.looseObject({
    symbol: z.string().optional(),
    results: z.array(BrokerSummaryRowSchema).optional(),
  }),
]);
export type BrokerSummary = z.infer<typeof BrokerSummarySchema>;

export const ListingPerformanceSchema = z.looseObject({
  symbol: z.string().optional(),
  listing_date: teks,
  offering_price: angka,
  chg_7d: angka,
  chg_30d: angka,
  chg_90d: angka,
  chg_365d: angka,
});
export type ListingPerformance = z.infer<typeof ListingPerformanceSchema>;

export const DailyBarSchema = z.looseObject({
  symbol: z.string().optional(),
  date: z.string(),
  close: angka,
  open: angka,
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
