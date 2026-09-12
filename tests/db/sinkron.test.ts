// sinkronDb: salin semua tabel data + ledger + cache antar dua DB (PGlite in-memory),
// idempoten (run kedua tidak menggandakan), perubahan sumber terbawa, baris tujuan
// yang tidak ada di sumber tidak disentuh. Tanpa nama pemegang saham sungguhan.
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createLedgerRepo } from "../../src/lib/db/repos/ledger";
import {
  apiCache,
  corporateActions,
  filings,
  financialsQ,
  reportDates,
  suspensions,
  symbols,
} from "../../src/lib/db/schema";
import { hitungBarisTabel, sinkronDb, uraiTarget } from "../../src/lib/db/sinkron";
import { makeTestDb, type TestDb } from "./test-db";

let a: TestDb;
let b: TestDb;

beforeAll(async () => {
  a = await makeTestDb("pglite");
  b = await makeTestDb("pglite");

  await a.db.insert(symbols).values([
    { symbol: "SRIL", companyName: "Sri Rejeki Isman Tbk", group: "delisting", targetEventDate: "2021-05-18", notes: "uji" },
    { symbol: "BBCA", companyName: "Bank Central Asia Tbk", group: "control" },
  ]);
  await a.db.insert(suspensions).values([
    { symbol: "SRIL", suspensionDate: "2021-05-18", reason: "uji" },
    { symbol: "GOLL", suspensionDate: "2019-01-30" },
  ]);
  await a.db.insert(reportDates).values([
    { symbol: "SRIL", reportDate: "2024-06-30", quarter: "q2", fiscalYear: 2024 },
    { symbol: "SRIL", reportDate: "2024-09-30", quarter: "q3", fiscalYear: 2024 },
  ]);
  // Dua baris identik yang sah (tanpa kunci unik) + satu emiten lain.
  await a.db.insert(corporateActions).values([
    { symbol: "SRIL", kind: "right_issue", eventDate: "2020-01-10", payload: { new_ratio: 5 } },
    { symbol: "SRIL", kind: "right_issue", eventDate: "2020-01-10", payload: { new_ratio: 5 } },
    { symbol: "BBCA", kind: "dividend", eventDate: "2025-04-01", payload: {} },
  ]);
  await a.db.insert(filings).values([
    {
      symbol: "BBCA",
      timestamp: new Date("2025-01-09T10:22:00Z"),
      holderName: null,
      holderType: "insider",
      transactionType: "sell",
      amountTransaction: 1000,
      price: 9500,
      transactionValue: 9_500_000,
      sharePctBefore: 0.5,
      sharePctAfter: 0.4,
      source: "uji",
    },
    { symbol: "BBCA", timestamp: new Date("2025-02-01T00:00:00Z"), holderType: "institution", transactionType: "buy" },
  ]);
  await a.db.insert(financialsQ).values({
    symbol: "SRIL",
    reportDate: "2024-09-30",
    totalEquity: -15_460_000_000_000,
    totalLiabilities: 1e12,
    totalAssets: 2e12,
    earnings: -1e11,
    revenue: 5e11,
    payload: { date: "2024-09-30" },
  });
  const ledger = createLedgerRepo(a.db);
  await ledger.append({ endpoint: "/v2/suspensions/", params: { limit: "30" }, status: 200, credits: 1, at: new Date("2026-09-07T00:00:00Z") });
  await ledger.append({ endpoint: "/v2/free-float/", params: {}, status: 200, credits: 10, at: new Date("2026-09-07T00:00:01Z") });
  await a.db.insert(apiCache).values({
    key: "kunci-uji-1",
    endpoint: "/v2/suspensions/",
    payload: { endpoint: "/v2/suspensions/", params: { limit: "30" }, storedAt: "2026-09-07T00:00:00.000Z", ttlMs: null, status: 200, body: { results: [] } },
    fetchedAt: new Date("2026-09-07T00:00:00Z"),
    expiresAt: null,
  });
}, 120_000);

afterAll(async () => {
  await a?.close();
  await b?.close();
});

describe("sinkronDb", () => {
  it("menyalin semua tabel; jumlah baris sama; run kedua tidak menggandakan apa pun", async () => {
    const h1 = await sinkronDb(a.db, b.db, { ukuranBatch: 2 });
    expect(h1.sama).toBe(true);
    expect(h1.baris).toEqual({
      symbols: { sumber: 2, tujuan: 2 },
      suspensions: { sumber: 2, tujuan: 2 },
      report_dates: { sumber: 2, tujuan: 2 },
      corporate_actions: { sumber: 3, tujuan: 3 },
      filings: { sumber: 2, tujuan: 2 },
      financials_q: { sumber: 1, tujuan: 1 },
      api_ledger: { sumber: 2, tujuan: 2 },
      api_cache: { sumber: 1, tujuan: 1 },
    });
    expect(h1.ledger).toMatchObject({ ledgerDisisipkan: 2, kreditDiMigrasi: 11, cacheDisisipkan: 1 });

    const [sril] = await b.db.select().from(symbols).where(eq(symbols.symbol, "SRIL"));
    expect(sril).toMatchObject({ companyName: "Sri Rejeki Isman Tbk", group: "delisting", targetEventDate: "2021-05-18", notes: "uji" });
    const [fin] = await b.db.select().from(financialsQ);
    expect(fin.totalEquity).toBe(-15_460_000_000_000);
    const [fil] = await b.db.select().from(filings).where(eq(filings.transactionType, "sell"));
    expect(fil.timestamp.toISOString()).toBe("2025-01-09T10:22:00.000Z");
    expect(fil.sharePctAfter).toBe(0.4);

    const h2 = await sinkronDb(a.db, b.db);
    expect(h2.sama).toBe(true);
    expect(h2.baris).toEqual(h1.baris);
    expect(h2.ledger).toMatchObject({ ledgerDisisipkan: 0, ledgerDilewati: 2, cacheDisisipkan: 0, cacheDilewati: 1 });
    expect((await createLedgerRepo(b.db).total()).credits).toBe(11);
  }, 60_000);

  it("perubahan di sumber terbawa; baris tujuan untuk emiten di luar sumber tidak disentuh", async () => {
    await a.db.update(symbols).set({ notes: "diubah" }).where(eq(symbols.symbol, "SRIL"));
    await a.db.update(financialsQ).set({ totalEquity: -1 }).where(eq(financialsQ.symbol, "SRIL"));
    await a.db.insert(corporateActions).values({ symbol: "SRIL", kind: "agm", eventDate: "2021-06-01", payload: {} });
    // Baris tujuan untuk emiten yang tidak ada di sumber harus tetap ada.
    await b.db.insert(corporateActions).values({ symbol: "XXXX", kind: "other", eventDate: "2020-01-01", payload: {} });

    const h = await sinkronDb(a.db, b.db);
    expect(h.baris.corporate_actions).toEqual({ sumber: 4, tujuan: 5 });
    expect(h.sama).toBe(false);

    const [sril] = await b.db.select().from(symbols).where(eq(symbols.symbol, "SRIL"));
    expect(sril.notes).toBe("diubah");
    const [fin] = await b.db.select().from(financialsQ).where(eq(financialsQ.symbol, "SRIL"));
    expect(fin.totalEquity).toBe(-1);
    expect(await b.db.select().from(corporateActions).where(eq(corporateActions.symbol, "SRIL"))).toHaveLength(3);
    expect(await b.db.select().from(corporateActions).where(eq(corporateActions.symbol, "XXXX"))).toHaveLength(1);

    const hitung = await hitungBarisTabel(b.db);
    expect(hitung.symbols).toBe(2);
    expect(hitung.api_ledger).toBe(2);
  }, 60_000);
});

describe("uraiTarget", () => {
  it("mengenali pglite, pglite:DIR, neon; menolak yang lain", () => {
    expect(uraiTarget("pglite")).toEqual({ jenis: "pglite", dir: ".pglite" });
    expect(uraiTarget("pglite:./.pglite-b")).toEqual({ jenis: "pglite", dir: "./.pglite-b" });
    expect(uraiTarget("pglite:", "x")).toEqual({ jenis: "pglite", dir: "x" });
    expect(uraiTarget("neon")).toEqual({ jenis: "neon" });
    expect(() => uraiTarget("mysql")).toThrow(/tidak dikenal/);
  });
});
