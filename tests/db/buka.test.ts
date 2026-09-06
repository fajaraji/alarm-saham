// bukaDb: tanpa DATABASE_URL harus MENOLAK kecuali folder PGlite dinyatakan eksplisit;
// PGlite berkas menerapkan migrasi ./drizzle dan durable (dibuka ulang tetap ada datanya).
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { bukaDb } from "../../src/lib/db/buka";
import { apiLedger } from "../../src/lib/db/schema";

describe("bukaDb", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("DATABASE_URL kosong tanpa --pglite → error yang menjelaskan", async () => {
    vi.stubEnv("DATABASE_URL", "");
    await expect(bukaDb()).rejects.toThrow(/DATABASE_URL kosong.*--pglite/);
  });

  it("PGlite berkas: migrasi diterapkan, data bertahan setelah ditutup & dibuka lagi", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const dir = await mkdtemp(path.join(os.tmpdir(), "alarm-saham-pglite-"));
    const a = await bukaDb({ pgliteDir: dir });
    expect(a.jenis).toBe("pglite");
    expect(a.keterangan).toContain("pglite");
    await a.db.insert(apiLedger).values({ endpoint: "/v2/x/", status: 200, credits: 2 });
    await a.tutup();

    const b = await bukaDb({ pgliteDir: dir });
    const rows = await b.db.select().from(apiLedger);
    expect(rows).toHaveLength(1);
    expect(rows[0].credits).toBe(2);
    await b.tutup();
  }, 60_000);
});
