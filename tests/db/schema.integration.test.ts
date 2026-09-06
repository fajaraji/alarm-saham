// Tes integrasi skema & migrasi: berjalan di Postgres Docker bila tersedia,
// selain itu PGlite in-memory. Hanya di-skip bila keduanya tidak ada.
import { and, asc, eq, lte } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCacheRepo } from "../../src/lib/db/repos/cache";
import { createLedgerRepo } from "../../src/lib/db/repos/ledger";
import {
  alarms,
  apiCache,
  apiLedger,
  corporateActions,
  filings,
  financialsQ,
  portfolios,
  reportDates,
  runs,
  suspensions,
  symbols,
} from "../../src/lib/db/schema";
import {
  detectTestDbKind,
  makeTestDb,
  migrationFileCount,
  type TestDb,
} from "./test-db";

const kind = await detectTestDbKind();
if (!kind) {
  console.warn(
    "[db] Tes integrasi DI-SKIP: Docker tidak berjalan dan @electric-sql/pglite tidak terpasang.",
  );
}

describe.skipIf(!kind)(`skema & migrasi (basis: ${kind ?? "tidak ada"})`, () => {
  let t: TestDb;

  beforeAll(async () => {
    t = await makeTestDb(kind!);
    console.info(`[db] basis DB uji: ${t.kind}`);
  }, 300_000);

  afterAll(async () => {
    await t?.close();
  });

  it("migrasi idempoten: dijalankan dua kali tanpa error dan tanpa duplikasi", async () => {
    const expected = migrationFileCount();
    expect(expected).toBeGreaterThan(0);
    expect(await t.appliedMigrations()).toBe(expected);
    await expect(t.migrate()).resolves.not.toThrow();
    expect(await t.appliedMigrations()).toBe(expected);
  });

  it("symbols: insert/select dengan enum group", async () => {
    await t.db.insert(symbols).values([
      {
        symbol: "SRIL",
        companyName: "Sri Rejeki Isman",
        subSector: "Apparel & Luxury Goods",
        group: "delisting",
        targetEventDate: "2024-11-01",
      },
      { symbol: "BBCA", group: "control" },
    ]);
    const rows = await t.db.select().from(symbols).orderBy(asc(symbols.symbol));
    expect(rows.map((r) => r.symbol)).toEqual(["BBCA", "SRIL"]);
    expect(rows[1].targetEventDate).toBe("2024-11-01");
    expect(rows[0].targetEventDate).toBeNull();
  });

  it("suspensions: unik per (symbol, tanggal) dan bisa difilter <= t", async () => {
    await t.db.insert(suspensions).values([
      { symbol: "COWL", suspensionDate: "2020-07-13", reason: "PKPU", pdfUrl: "https://x/a.pdf" },
      { symbol: "COWL", suspensionDate: "2021-01-04" },
      { symbol: "MTRA", suspensionDate: "2020-11-17" },
    ]);
    await expect(
      t.db.insert(suspensions).values({ symbol: "COWL", suspensionDate: "2020-07-13" }),
    ).rejects.toThrow();

    const uptoT = await t.db
      .select({ d: suspensions.suspensionDate })
      .from(suspensions)
      .where(and(eq(suspensions.symbol, "COWL"), lte(suspensions.suspensionDate, "2020-12-31")));
    expect(uptoT.map((r) => r.d)).toEqual(["2020-07-13"]);
  });

  it("report_dates: insert/select", async () => {
    await t.db.insert(reportDates).values([
      { symbol: "SRIL", reportDate: "2021-03-31", quarter: "q1", fiscalYear: 2021 },
      { symbol: "SRIL", reportDate: "2021-06-30", quarter: "q2", fiscalYear: 2021 },
    ]);
    const rows = await t.db
      .select()
      .from(reportDates)
      .where(lte(reportDates.reportDate, "2021-04-30"));
    expect(rows).toHaveLength(1);
    expect(rows[0].quarter).toBe("q1");
  });

  it("filings: numeric kembali sebagai number", async () => {
    await t.db.insert(filings).values({
      symbol: "SRIL",
      timestamp: new Date("2021-02-15T03:00:00Z"),
      holderName: "Iwan Setiawan",
      holderType: "insider",
      transactionType: "sell",
      amountTransaction: 1_000_000,
      price: 150,
      transactionValue: 150_000_000.5,
      sharePctBefore: 12.345678,
      sharePctAfter: 11.5,
      source: "https://idx/x.pdf",
    });
    const [row] = await t.db.select().from(filings).where(eq(filings.symbol, "SRIL"));
    expect(row.transactionValue).toBe(150_000_000.5);
    expect(row.sharePctBefore).toBeCloseTo(12.345678, 6);
    expect(row.timestamp).toBeInstanceOf(Date);
  });

  it("corporate_actions: enum kind + payload jsonb", async () => {
    await t.db.insert(corporateActions).values({
      symbol: "SRIL",
      kind: "right_issue",
      eventDate: "2019-05-02",
      payload: { ratio: "10:3", price: 100 },
    });
    const [row] = await t.db.select().from(corporateActions);
    expect(row.kind).toBe("right_issue");
    expect(row.payload).toEqual({ ratio: "10:3", price: 100 });
  });

  it("financials_q: unik (symbol, report_date), ekuitas negatif tersimpan", async () => {
    await t.db.insert(financialsQ).values({
      symbol: "SRIL",
      reportDate: "2021-12-31",
      totalEquity: -12_345_678_901_234.56,
      totalLiabilities: 20_000_000_000_000,
      totalAssets: 7_654_321_098_765.44,
      earnings: -1,
      revenue: 0,
    });
    await expect(
      t.db.insert(financialsQ).values({ symbol: "SRIL", reportDate: "2021-12-31" }),
    ).rejects.toThrow();
    const [row] = await t.db.select().from(financialsQ);
    expect(row.totalEquity).toBeLessThan(0);
    expect(row.payload).toEqual({});
  });

  it("alarms, portfolios, runs: uuid default, array, FK cascade", async () => {
    const [alarm] = await t.db
      .insert(alarms)
      .values({ ownerToken: "tok-1", name: "Alarm delisting", rules: [{ block: "suspended" }] })
      .returning();
    expect(alarm.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(alarm.createdAt).toBeInstanceOf(Date);

    const [pf] = await t.db
      .insert(portfolios)
      .values({ ownerToken: "tok-1", symbols: ["SRIL", "BBCA"], alarmIds: [alarm.id] })
      .returning();
    expect(pf.symbols).toEqual(["SRIL", "BBCA"]);
    expect(pf.alarmIds).toEqual([alarm.id]);

    await t.db.insert(runs).values({ alarmId: alarm.id, score: { earlyMonths: 14 } });
    expect(await t.db.select().from(runs)).toHaveLength(1);

    await t.db.delete(alarms).where(eq(alarms.id, alarm.id));
    expect(await t.db.select().from(runs)).toHaveLength(0);
  });

  it("api_ledger via ledgerRepo.append/total", async () => {
    const ledger = createLedgerRepo(t.db);
    const t0 = new Date("2026-09-01T00:00:00Z");
    await ledger.append({ endpoint: "/v2/suspensions/", params: { offset: 0 }, status: 200, credits: 1, at: t0 });
    await ledger.append({ endpoint: "/v2/suspensions/", params: { offset: 30 }, status: 200, credits: 1, at: new Date("2026-09-02T00:00:00Z") });
    await ledger.append({ endpoint: "/v2/suspensions/", status: 200, credits: 0, cacheHit: true });
    await ledger.append({ endpoint: "/v2/filings/", status: 429, credits: 0 });

    expect(await ledger.total()).toEqual({ calls: 4, credits: 2 });
    expect(await ledger.total({ since: new Date("2026-09-02T00:00:00Z") })).toEqual({ calls: 3, credits: 1 });

    const rows = await t.db.select().from(apiLedger).where(eq(apiLedger.cacheHit, 1));
    expect(rows).toHaveLength(1);
    expect(rows[0].params).toEqual({});
  });

  it("api_cache via cacheRepo.get/set: upsert, permanen, kedaluwarsa", async () => {
    const cache = createCacheRepo(t.db);
    expect(await cache.get("tidak-ada")).toBeNull();

    await cache.set({ key: "susp:0", endpoint: "/v2/suspensions/", payload: { results: [1] } });
    expect(await cache.get("susp:0")).toEqual({ results: [1] });

    await cache.set({ key: "susp:0", endpoint: "/v2/suspensions/", payload: { results: [1, 2] } });
    expect(await cache.get("susp:0")).toEqual({ results: [1, 2] });
    expect(await t.db.select().from(apiCache)).toHaveLength(1);

    const now = new Date("2026-09-07T00:00:00Z");
    await cache.set({ key: "daily:BBCA", endpoint: "/v2/daily/BBCA/", payload: [1], ttlMs: 60_000, now });
    expect(await cache.get("daily:BBCA", new Date(now.getTime() + 59_000))).toEqual([1]);
    expect(await cache.get("daily:BBCA", new Date(now.getTime() + 60_000))).toBeNull();

    await cache.delete("daily:BBCA");
    expect(await cache.get("daily:BBCA", now)).toBeNull();
  });
});
