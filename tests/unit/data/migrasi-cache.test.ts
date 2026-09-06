// Migrasi ledger.jsonl + berkas cache → api_ledger/api_cache (PGlite), idempoten.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CacheDb, CacheRespons, Ledger, LedgerDb, TTL_404_MS, TTL_SEHARI_MS, migrasiCacheKeDb } from "../../../src/lib/data";
import { apiCache, apiLedger } from "../../../src/lib/db/schema";
import { makeTestDb, type TestDb } from "../../db/test-db";
import { dirSementara } from "./mock-sectors";

let t: TestDb;
beforeAll(async () => {
  t = await makeTestDb("pglite");
}, 120_000);
afterAll(async () => {
  await t?.close();
});

describe("migrasiCacheKeDb", () => {
  it("memindahkan semua baris & entri, menjaga kredit/TTL, dan run kedua tidak menggandakan", async () => {
    const dir = await dirSementara();
    const ledger = new Ledger(dir);
    const t0 = "2026-09-06T19:25:33.758Z";
    await ledger.catat({ ts: t0, endpoint: "/v2/suspensions/", params: { symbol: "SRIL" }, status: 200, credits: 1, cacheHit: false });
    await ledger.catat({ ts: "2026-09-06T19:25:34.000Z", endpoint: "/v2/listing-performance/SRIL/", params: {}, status: 404, credits: 1, cacheHit: false, note: "not_found" });
    await ledger.catat({ ts: "2026-09-06T19:25:35.000Z", endpoint: "/v2/suspensions/", params: { symbol: "SRIL" }, status: 200, credits: 0, cacheHit: true });
    await ledger.catat({ ts: "2026-09-06T19:25:36.000Z", endpoint: "/v2/daily/WIKA/", params: {}, status: null, credits: 0, cacheHit: false, note: "gagal jaringan: x" });

    const jamSimpan = new Date("2026-09-06T19:25:33.758Z");
    const cacheFile = new CacheRespons(dir, () => jamSimpan);
    await cacheFile.tulis("/v2/suspensions/", { symbol: "SRIL" }, 200, { results: [{ symbol: "SRIL.JK", suspension_date: "2021-05-18" }] }, null);
    await cacheFile.tulis("/v2/listing-performance/SRIL/", {}, 404, { code: "not_found" }, TTL_404_MS);
    await cacheFile.tulis("/v2/free-float/", {}, 200, [{ symbol: "BBCA.JK", free_float: 0.45 }], TTL_SEHARI_MS);

    const h1 = await migrasiCacheKeDb(dir, t.db);
    expect(h1).toMatchObject({ ledgerDibaca: 4, ledgerDisisipkan: 4, ledgerDilewati: 0, kreditDiMigrasi: 2, cacheDibaca: 3, cacheDisisipkan: 3, cacheDilewati: 0 });

    const ledgerDb = new LedgerDb(t.db);
    expect(await ledgerDb.totalKredit()).toBe(2);
    const baris = await ledgerDb.semua();
    expect(baris).toHaveLength(4);
    expect(baris[0]).toMatchObject({ ts: t0, endpoint: "/v2/suspensions/", params: { symbol: "SRIL" }, credits: 1, cacheHit: false });
    expect(baris[1].note).toBe("not_found");
    expect(baris[3].status).toBeNull();

    // Cache: permanen tanpa expires_at; 404 kedaluwarsa 30 hari sejak storedAt; free-float 24 jam.
    const rows = await t.db.select().from(apiCache);
    expect(rows).toHaveLength(3);
    const petaExp = new Map(rows.map((r) => [r.endpoint, r.expiresAt]));
    expect(petaExp.get("/v2/suspensions/")).toBeNull();
    expect(petaExp.get("/v2/listing-performance/SRIL/")?.getTime()).toBe(jamSimpan.getTime() + TTL_404_MS);
    expect(petaExp.get("/v2/free-float/")?.getTime()).toBe(jamSimpan.getTime() + TTL_SEHARI_MS);

    // CacheDb membaca entri yang dimigrasi dengan semantik yang sama dengan berkas.
    const cacheDb = new CacheDb(t.db, () => new Date("2026-09-08T03:00:00Z")); // > 24 jam, < 30 hari
    expect((await cacheDb.baca("/v2/suspensions/", { symbol: "SRIL" }))?.status).toBe(200);
    expect((await cacheDb.baca("/v2/listing-performance/SRIL/", {}))?.status).toBe(404);
    expect(await cacheDb.baca("/v2/free-float/", {})).toBeNull(); // sudah > 24 jam

    // Idempoten.
    const h2 = await migrasiCacheKeDb(dir, t.db);
    expect(h2).toMatchObject({ ledgerDisisipkan: 0, ledgerDilewati: 4, cacheDisisipkan: 0, cacheDilewati: 3 });
    expect(await t.db.select().from(apiLedger)).toHaveLength(4);
    expect(await ledgerDb.totalKredit()).toBe(2);
  });

  it("folder kosong / tidak ada → tidak error, 0 baris", async () => {
    const h = await migrasiCacheKeDb("folder-yang-tidak-ada-uji", t.db);
    expect(h.ledgerDibaca).toBe(0);
    expect(h.cacheDibaca).toBe(0);
  });
});
