// Route /api/cron/jaga (tiket 12) di atas PGlite in-memory:
// 503 tanpa CRON_SECRET di server; 401 tanpa/salah Bearer; 200 dengan secret →
// ringkasan {portofolio, benderaBaru, terkirim: {inapp, telegram}}; run kedua
// 0 pesan; TELEGRAM_BOT_TOKEN kosong → telegramAktif false; 501 tanpa DB.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { Db } from "../../src/lib/db/client";
import { portfolios } from "../../src/lib/db/schema";
import { fromDb, universeFromDb } from "../../src/lib/engine/events";
import type { SumberKejadian } from "../../src/lib/engine/sumber";
import { ID_ALARM_PAILIT } from "../../src/lib/jaga/bawaan";
import { muatKotakMasuk } from "../../src/lib/jaga/inbox";
import { seedUniverseKecil } from "./seed-universe-kecil";
import { makeTestDb, type TestDb } from "./test-db";

let dbAktif: Db | null = null;
vi.mock("../../src/lib/jaga/penyedia", () => ({
  dbJaga: async () => dbAktif,
  sumberJaga: async (): Promise<SumberKejadian> =>
    dbAktif
      ? { jenis: "pglite", keterangan: "pglite uji", source: fromDb(dbAktif), db: dbAktif, universe: () => universeFromDb(dbAktif!), tutup: async () => {} }
      : { jenis: "fixture", keterangan: "fixture", source: { name: "fixture", events: async () => ({ symbol: "", suspensions: [], quarters: [], rightIssues: [], financials: [], filings: [] }) } as never, db: null, universe: async () => [], tutup: async () => {} },
  providerKelasB: () => undefined,
}));

const { GET, POST } = await import("../../src/app/api/cron/jaga/route");

const adaPglite = await import("@electric-sql/pglite").then(
  () => true,
  () => false,
);
if (!adaPglite) console.warn("[cron] Tes route DI-SKIP: @electric-sql/pglite tidak terpasang.");

const RAHASIA = "rahasia-cron-uji-1234567890";
const OWNER = "aaaaaaaa-0000-4000-8000-00000000000a";

function req(auth?: string, method = "GET", query = "?today=2026-09-07"): Request {
  return new Request(`http://localhost/api/cron/jaga${query}`, { method, headers: auth ? { authorization: auth } : {} });
}

describe.skipIf(!adaPglite)("/api/cron/jaga (PGlite in-memory)", () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await makeTestDb("pglite");
    await seedUniverseKecil(t.db);
    await t.db.insert(portfolios).values({ ownerToken: OWNER, symbols: ["SRIL", "BBCA"], alarmIds: [ID_ALARM_PAILIT] });
    dbAktif = t.db;
  });
  afterAll(async () => {
    dbAktif = null;
    await t.close();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("503 bila CRON_SECRET belum diatur di server (endpoint tidak pernah terbuka)", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await GET(req(`Bearer ${RAHASIA}`));
    expect(res.status).toBe(503);
    expect((await res.json()).error.kode).toBe("CRON_SECRET_BELUM_DIATUR");
  });

  it("401 tanpa header / secret salah — tidak ada yang diproses", async () => {
    vi.stubEnv("CRON_SECRET", RAHASIA);
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer salah"))).status).toBe(401);
    expect((await POST(req(RAHASIA, "POST"))).status).toBe(401); // tanpa awalan Bearer
    expect(await muatKotakMasuk(t.db, OWNER)).toEqual([]);
  });

  it("200 dengan secret: memproses portofolio, mengisi inbox; tanpa token Telegram → telegramAktif false", async () => {
    vi.stubEnv("CRON_SECRET", RAHASIA);
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    const res = await GET(req(`Bearer ${RAHASIA}`));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.telegramAktif).toBe(false);
    expect(json.today).toBe("2026-09-07");
    expect(json.portofolio).toBe(1);
    expect(json.benderaBaru).toBe(1);
    expect(json.terkirim).toEqual({ inapp: 1, telegram: 0 });
    expect(json.galat).toEqual([]);
    const kotak = await muatKotakMasuk(t.db, OWNER);
    expect(kotak).toHaveLength(1);
    expect(kotak[0].symbol).toBe("SRIL");
  });

  it("pemanggilan kedua (POST manual) → 0 bendera baru, 0 pesan", async () => {
    vi.stubEnv("CRON_SECRET", RAHASIA);
    const res = await POST(req(`Bearer ${RAHASIA}`, "POST"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.benderaBaru).toBe(0);
    expect(json.terkirim).toEqual({ inapp: 0, telegram: 0 });
    expect(await muatKotakMasuk(t.db, OWNER)).toHaveLength(1);
  });

  it("400 bila today bukan YYYY-MM-DD; 501 bila server tanpa DB", async () => {
    vi.stubEnv("CRON_SECRET", RAHASIA);
    expect((await GET(req(`Bearer ${RAHASIA}`, "GET", "?today=kemarin"))).status).toBe(400);
    dbAktif = null;
    const res = await GET(req(`Bearer ${RAHASIA}`));
    expect(res.status).toBe(501);
    expect((await res.json()).error.kode).toBe("DB_TIDAK_TERSEDIA");
    dbAktif = t.db;
  });
});
