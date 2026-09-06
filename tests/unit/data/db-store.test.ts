// Jalur DB untuk ledger & cache SectorsProvider (LedgerDb/CacheDb) di PGlite:
// kontrak DataProvider yang sama + semantik kredit/cache/404/TTL yang sama dengan berkas.
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CacheDb,
  LedgerDb,
  NotFoundError,
  SectorsProvider,
  kunciCache,
  sectorsProviderDariEnv,
} from "../../../src/lib/data";
import { apiCache, apiLedger } from "../../../src/lib/db/schema";
import { makeTestDb, type TestDb } from "../../db/test-db";
import { ujiKontrakDataProvider } from "./kontrak";
import { buatFetchFixture, jsonResponse } from "./mock-sectors";

const KUNCI = "kunci-rahasia-uji-DB-123";

let t: TestDb;
beforeAll(async () => {
  t = await makeTestDb("pglite");
}, 120_000);
afterAll(async () => {
  await t?.close();
});

ujiKontrakDataProvider("SectorsProvider (penyimpan DB PGlite)", async () => {
  vi.stubGlobal("fetch", buatFetchFixture().fetch);
  await t.db.delete(apiCache);
  await t.db.delete(apiLedger);
  return new SectorsProvider({ apiKey: KUNCI, ledger: new LedgerDb(t.db), cache: new CacheDb(t.db), retryBaseMs: 0 });
});

describe("SectorsProvider + LedgerDb/CacheDb", () => {
  let jam: Date;
  const now = () => jam;

  // Tabel dibagi dengan tes kontrak di atas → bersihkan sebelum & sesudah tiap tes.
  beforeEach(async () => {
    await t.db.delete(apiCache);
    await t.db.delete(apiLedger);
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await t.db.delete(apiCache);
    await t.db.delete(apiLedger);
  });

  function provider(opsi: Partial<ConstructorParameters<typeof SectorsProvider>[0]> = {}) {
    jam = jam ?? new Date("2026-09-07T03:00:00Z");
    return new SectorsProvider({
      apiKey: KUNCI,
      ledger: new LedgerDb(t.db),
      cache: new CacheDb(t.db, now),
      retryBaseMs: 0,
      now,
      ...opsi,
    });
  }
  function fetchUrutan(...respons: Array<() => Response>) {
    const f = vi.fn(async () => (respons.length > 1 ? respons.shift()! : respons[0])());
    vi.stubGlobal("fetch", f);
    return f;
  }

  it("penyimpan = db; panggilan pertama 1 kredit ke api_ledger, kedua dari api_cache 0 kredit", async () => {
    jam = new Date("2026-09-07T03:00:00Z");
    const f = fetchUrutan(() => jsonResponse(200, { symbol: "SRIL.JK", corporate_actions: { dividend: [] } }));
    const p = provider();
    expect(p.penyimpan).toBe("db");
    await p.corporateActions("SRIL");
    await p.corporateActions("SRIL");
    expect(f).toHaveBeenCalledTimes(1);

    const baris = await p.ledger.semua();
    expect(baris).toHaveLength(2);
    expect(baris[0]).toMatchObject({ endpoint: "/v2/company/corporate-actions/SRIL/", status: 200, credits: 1, cacheHit: false });
    expect(baris[1]).toMatchObject({ credits: 0, cacheHit: true });
    expect(baris[0].ts).toBe(jam.toISOString());
    expect(await p.ledger.totalKredit()).toBe(1);
    expect(await p.sisaKredit()).toBe(999);

    const rows = await t.db.select().from(apiCache);
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe(kunciCache("/v2/company/corporate-actions/SRIL/", {}));
    expect(rows[0].expiresAt).toBeNull(); // permanen
    expect(await p.cache.kunciBerlaku()).toEqual(new Set([rows[0].key]));
  });

  it("404 di-cache 30 hari di DB: fetch sekali, 1 kredit, tetap NotFoundError; note tersimpan", async () => {
    jam = new Date("2026-09-07T03:00:00Z");
    const f = fetchUrutan(() => jsonResponse(404, { code: "not_found", message: "tidak ada data" }));
    const p = provider();
    await expect(p.listingPerformance("SRIL")).rejects.toBeInstanceOf(NotFoundError);
    await expect(p.listingPerformance("SRIL")).rejects.toBeInstanceOf(NotFoundError);
    expect(f).toHaveBeenCalledTimes(1);
    expect(await p.ledger.totalKredit()).toBe(1);
    const [row] = await t.db.select().from(apiLedger).where(eq(apiLedger.cacheHit, 0));
    expect(row.note).toBe("not_found");
    const [c] = await t.db.select().from(apiCache);
    expect(c.expiresAt).not.toBeNull();

    jam = new Date(jam.getTime() + 31 * 24 * 3600_000);
    await expect(p.listingPerformance("SRIL")).rejects.toBeInstanceOf(NotFoundError);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("TTL 24 jam untuk data terkini; kunciBerlaku mengecualikan yang kedaluwarsa", async () => {
    jam = new Date("2026-09-07T03:00:00Z");
    const f = fetchUrutan(() => jsonResponse(200, []));
    const p = provider();
    await p.freeFloat();
    expect((await p.cache.kunciBerlaku()).size).toBe(1);
    jam = new Date(jam.getTime() + 25 * 3600_000);
    expect((await p.cache.kunciBerlaku()).size).toBe(0);
    await p.freeFloat();
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("gagal jaringan: status null → disimpan 0 lalu dibaca kembali null, 0 kredit, note", async () => {
    jam = new Date("2026-09-07T03:00:00Z");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNRESET");
      }),
    );
    await expect(provider({ retry: 0 }).freeFloat()).rejects.toThrow(/network_error/);
    const baris = await new LedgerDb(t.db).semua();
    expect(baris).toHaveLength(1);
    expect(baris[0].status).toBeNull();
    expect(baris[0].note).toMatch(/gagal jaringan/);
    expect(await new LedgerDb(t.db).totalKredit()).toBe(0);
  });

  it("sectorsProviderDariEnv: tanpa DATABASE_URL → berkas; penyimpan yang disuntik menang", () => {
    const berkas = sectorsProviderDariEnv({ SECTORS_API_KEY: KUNCI, SECTORS_CACHE_DIR: "tmp-uji" })!;
    expect(berkas.penyimpan).toBe("file");
    const disuntik = sectorsProviderDariEnv(
      { SECTORS_API_KEY: KUNCI, DATABASE_URL: "postgres://localhost:5432/tidak-dipakai" },
      { ledger: new LedgerDb(t.db), cache: new CacheDb(t.db) },
    )!;
    expect(disuntik.penyimpan).toBe("db");
  });
});
