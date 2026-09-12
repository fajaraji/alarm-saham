// Skema database Alarm Saham (Postgres, Drizzle pg-core).
//
// Prinsip: setiap tabel data pasar menyimpan tanggal kejadian per simbol dan
// diindeks (symbol, tanggal) agar mesin uji-ke-masa-lalu (tiket 06) bisa
// memfilter "hanya data bertanggal <= t" tanpa lookahead. Tabel data TIDAK
// ber-FK ke `symbols` karena feed universe (mis. suspensions seluruh bursa)
// memuat emiten di luar universe uji.
import {
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// Nilai uang IDR bisa mencapai ratusan triliun; numeric menjaga presisi di DB,
// mode "number" agar nyaman dipakai di TS (aman sampai 2^53).
const money = (name: string) =>
  numeric(name, { precision: 28, scale: 2, mode: "number" });
const pct = (name: string) =>
  numeric(name, { precision: 12, scale: 6, mode: "number" });
const tsz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });
const day = (name: string) => date(name, { mode: "string" });

// ---------------------------------------------------------------------------
// Universe emiten
// ---------------------------------------------------------------------------
export const symbolGroupEnum = pgEnum("symbol_group", [
  "delisting",
  "watchlist",
  "control",
]);

export const symbols = pgTable("symbols", {
  symbol: text("symbol").primaryKey(),
  companyName: text("company_name"),
  subSector: text("sub_sector"),
  group: symbolGroupEnum("group").notNull(),
  // Tanggal kejadian target (suspensi terakhir menuju delisting, atau masuk
  // suspensi > 6 bulan). NULL untuk kontrol sehat.
  targetEventDate: day("target_event_date"),
  notes: text("notes"),
});

// ---------------------------------------------------------------------------
// Data bertanggal per simbol (kelas A)
// ---------------------------------------------------------------------------
export const suspensions = pgTable(
  "suspensions",
  {
    id: serial("id").primaryKey(),
    symbol: text("symbol").notNull(),
    suspensionDate: day("suspension_date").notNull(),
    reason: text("reason"),
    pdfUrl: text("pdf_url"),
  },
  (t) => [
    unique("suspensions_symbol_date_uq").on(t.symbol, t.suspensionDate),
    index("suspensions_symbol_date_idx").on(t.symbol, t.suspensionDate),
  ],
);

export const reportDates = pgTable(
  "report_dates",
  {
    id: serial("id").primaryKey(),
    symbol: text("symbol").notNull(),
    reportDate: day("report_date").notNull(),
    // Label kuartal dari Sectors: "q1".."q4" (atau "annual").
    quarter: text("quarter").notNull(),
    fiscalYear: integer("fiscal_year").notNull(),
  },
  (t) => [
    unique("report_dates_symbol_year_quarter_uq").on(
      t.symbol,
      t.fiscalYear,
      t.quarter,
    ),
    index("report_dates_symbol_date_idx").on(t.symbol, t.reportDate),
  ],
);

export const filings = pgTable(
  "filings",
  {
    id: serial("id").primaryKey(),
    symbol: text("symbol").notNull(),
    timestamp: tsz("timestamp").notNull(),
    holderName: text("holder_name"),
    // insider | institution | corporate-investor. Sengaja bukan enum agar nilai
    // baru dari API tidak memecahkan insert.
    holderType: text("holder_type"),
    // buy | sell | others
    transactionType: text("transaction_type"),
    amountTransaction: money("amount_transaction"),
    price: money("price"),
    transactionValue: money("transaction_value"),
    sharePctBefore: pct("share_pct_before"),
    sharePctAfter: pct("share_pct_after"),
    source: text("source"),
  },
  (t) => [index("filings_symbol_ts_idx").on(t.symbol, t.timestamp)],
);

export const corporateActionKindEnum = pgEnum("corporate_action_kind", [
  "dividend",
  "stock_split",
  "right_issue",
  "warrant",
  "bonus",
  "agm",
  "other",
]);

export const corporateActions = pgTable(
  "corporate_actions",
  {
    id: serial("id").primaryKey(),
    symbol: text("symbol").notNull(),
    kind: corporateActionKindEnum("kind").notNull(),
    eventDate: day("event_date").notNull(),
    // Isi mentah dari Sectors (rasio split, harga rights, dsb.).
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
  },
  (t) => [
    index("corporate_actions_symbol_date_idx").on(t.symbol, t.eventDate),
  ],
);

export const financialsQ = pgTable(
  "financials_q",
  {
    id: serial("id").primaryKey(),
    symbol: text("symbol").notNull(),
    reportDate: day("report_date").notNull(),
    totalEquity: money("total_equity"),
    totalLiabilities: money("total_liabilities"),
    totalAssets: money("total_assets"),
    earnings: money("earnings"),
    revenue: money("revenue"),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
  },
  (t) => [
    unique("financials_q_symbol_date_uq").on(t.symbol, t.reportDate),
    index("financials_q_symbol_date_idx").on(t.symbol, t.reportDate),
  ],
);

// ---------------------------------------------------------------------------
// Alarm, portofolio, hasil eksekusi
// ---------------------------------------------------------------------------
export const alarms = pgTable(
  "alarms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Token pemilik anonim (cookie), tanpa akun.
    ownerToken: text("owner_token").notNull(),
    name: text("name").notNull(),
    // Blok/aturan alarm; skema Zod divalidasi di lapisan aplikasi.
    rules: jsonb("rules").$type<unknown[]>().notNull().default([]),
    lastScore: jsonb("last_score").$type<Record<string, unknown>>(),
    createdAt: tsz("created_at").defaultNow().notNull(),
  },
  (t) => [index("alarms_owner_idx").on(t.ownerToken)],
);

export const portfolios = pgTable(
  "portfolios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerToken: text("owner_token").notNull(),
    symbols: text("symbols").array().notNull().default([]),
    alarmIds: uuid("alarm_ids").array().notNull().default([]),
    createdAt: tsz("created_at").defaultNow().notNull(),
  },
  (t) => [index("portfolios_owner_idx").on(t.ownerToken)],
);

export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    alarmId: uuid("alarm_id")
      .notNull()
      .references(() => alarms.id, { onDelete: "cascade" }),
    ranAt: tsz("ran_at").defaultNow().notNull(),
    score: jsonb("score").$type<Record<string, unknown>>().notNull().default({}),
    details: jsonb("details")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
  },
  (t) => [index("runs_alarm_ran_at_idx").on(t.alarmId, t.ranAt)],
);

// ---------------------------------------------------------------------------
// Buku kredit & cache panggilan API Sectors
// ---------------------------------------------------------------------------
export const apiLedger = pgTable(
  "api_ledger",
  {
    id: serial("id").primaryKey(),
    at: tsz("at").defaultNow().notNull(),
    endpoint: text("endpoint").notNull(),
    params: jsonb("params")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    status: integer("status").notNull(),
    credits: integer("credits").notNull().default(0),
    // 1 = dilayani dari cache (tanpa panggilan HTTP), 0 = panggilan sungguhan.
    cacheHit: integer("cache_hit").notNull().default(0),
    // Kode error Sectors / catatan gagal jaringan (paritas dengan ledger file tiket 03).
    note: text("note"),
  },
  (t) => [index("api_ledger_at_idx").on(t.at)],
);

export const apiCache = pgTable(
  "api_cache",
  {
    key: text("key").primaryKey(),
    endpoint: text("endpoint").notNull(),
    payload: jsonb("payload").$type<unknown>().notNull(),
    fetchedAt: tsz("fetched_at").defaultNow().notNull(),
    // NULL = permanen (data historis tidak berubah).
    expiresAt: tsz("expires_at"),
  },
  (t) => [index("api_cache_endpoint_idx").on(t.endpoint)],
);

// ---------------------------------------------------------------------------
// Notifikasi harian (tiket 12): kotak masuk in-app & tautan chat Telegram
// ---------------------------------------------------------------------------
// Satu baris = satu bendera baru untuk satu pemilik (fallback PLAN §7.5: selalu
// ditulis, dengan atau tanpa Telegram). Tanpa FK ke portfolios/runs agar pesan
// tetap terbaca walau portofolio dikosongkan.
export const inbox = pgTable(
  "inbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerToken: text("owner_token").notNull(),
    portfolioId: uuid("portfolio_id"),
    runId: uuid("run_id"),
    symbol: text("symbol").notNull(),
    // hijau | kuning | merah (StatusSaham); teks agar nilai baru tidak memecahkan insert.
    status: text("status").notNull(),
    judul: text("judul").notNull(),
    teks: text("teks").notNull(),
    readAt: tsz("read_at"),
    createdAt: tsz("created_at").defaultNow().notNull(),
  },
  (t) => [index("inbox_owner_created_idx").on(t.ownerToken, t.createdAt)],
);

// chat_id Telegram (bigint, disimpan sebagai teks) → pemilik yang mengetik
// `/mulai <kode-portofolio>` di bot. Satu chat hanya menautkan satu pemilik.
export const telegramLinks = pgTable(
  "telegram_links",
  {
    chatId: text("chat_id").primaryKey(),
    ownerToken: text("owner_token").notNull(),
    portfolioId: uuid("portfolio_id"),
    linkedAt: tsz("linked_at").defaultNow().notNull(),
  },
  (t) => [index("telegram_links_owner_idx").on(t.ownerToken)],
);

// Tipe bantu
export type SymbolRow = typeof symbols.$inferSelect;
export type NewSymbolRow = typeof symbols.$inferInsert;
export type Suspension = typeof suspensions.$inferSelect;
export type ReportDateRow = typeof reportDates.$inferSelect;
export type Filing = typeof filings.$inferSelect;
export type CorporateAction = typeof corporateActions.$inferSelect;
export type FinancialQ = typeof financialsQ.$inferSelect;
export type Alarm = typeof alarms.$inferSelect;
export type Portfolio = typeof portfolios.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type InboxRow = typeof inbox.$inferSelect;
export type TelegramLink = typeof telegramLinks.$inferSelect;
export type ApiLedgerEntry = typeof apiLedger.$inferSelect;
export type ApiCacheEntry = typeof apiCache.$inferSelect;
