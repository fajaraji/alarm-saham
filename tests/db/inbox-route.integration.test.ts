// Route /api/inbox (tiket 12) di atas PGlite in-memory: 401 tanpa token; GET
// memuat pesan pemilik saja (bentuk = PesanKotakMasuk klien); PATCH menandai
// dibaca; 501 bila server tanpa DB.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Db } from "../../src/lib/db/client";
import { tulisKotakMasuk } from "../../src/lib/jaga/inbox";
import { makeTestDb, type TestDb } from "./test-db";

let dbAktif: Db | null = null;
vi.mock("../../src/lib/jaga/penyedia", () => ({
  dbJaga: async () => dbAktif,
  sumberJaga: async () => {
    throw new Error("tidak dipakai di tes ini");
  },
  providerKelasB: () => undefined,
}));

const { GET, PATCH } = await import("../../src/app/api/inbox/route");

const adaPglite = await import("@electric-sql/pglite").then(
  () => true,
  () => false,
);
if (!adaPglite) console.warn("[inbox] Tes route DI-SKIP: @electric-sql/pglite tidak terpasang.");

const TOKEN_A = "3f1c2a8e-7b4d-4c9a-9e1f-0a2b3c4d5e6f";
const TOKEN_B = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

function req(method: string, token: string | null): Request {
  return new Request("http://localhost/api/inbox", { method, headers: token ? { "x-owner-token": token } : {} });
}

describe.skipIf(!adaPglite)("/api/inbox (PGlite in-memory)", () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await makeTestDb("pglite");
    dbAktif = t.db;
    await tulisKotakMasuk(t.db, [
      { owner: TOKEN_A, portfolioId: null, runId: null, symbol: "SRIL", status: "merah", judul: "SRIL: alarm berbunyi", teks: "SRIL tersuspensi." },
      { owner: TOKEN_A, portfolioId: null, runId: null, symbol: "GOLL", status: "kuning", judul: "GOLL: status kuning", teks: "GOLL satu tanda." },
      { owner: TOKEN_B, portfolioId: null, runId: null, symbol: "WIKA", status: "kuning", judul: "WIKA", teks: "WIKA." },
    ]);
  });
  afterAll(async () => {
    dbAktif = null;
    await t.close();
  });

  it("401 tanpa header x-owner-token", async () => {
    expect((await GET(req("GET", null))).status).toBe(401);
    expect((await PATCH(req("PATCH", "pendek"))).status).toBe(401);
  });

  it("GET memuat pesan pemilik saja, terbaru dulu, bentuk PesanKotakMasuk", async () => {
    const res = await GET(req("GET", TOKEN_A));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.belumDibaca).toBe(2);
    expect(json.pesan).toHaveLength(2);
    expect(json.pesan.map((p: { symbol: string }) => p.symbol).sort()).toEqual(["GOLL", "SRIL"]);
    for (const p of json.pesan) {
      expect(p).toMatchObject({ baru: true });
      expect(typeof p.id).toBe("string");
      expect(p.waktu).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(["hijau", "kuning", "merah"]).toContain(p.status);
    }
    const b = await (await GET(req("GET", TOKEN_B))).json();
    expect(b.pesan.map((p: { symbol: string }) => p.symbol)).toEqual(["WIKA"]);
  });

  it("PATCH menandai semua pesan pemilik dibaca (pemilik lain tidak tersentuh); ulang → 0", async () => {
    expect(await (await PATCH(req("PATCH", TOKEN_A))).json()).toEqual({ dibaca: 2 });
    const a = await (await GET(req("GET", TOKEN_A))).json();
    expect(a.belumDibaca).toBe(0);
    expect(a.pesan.every((p: { baru: boolean }) => p.baru === false)).toBe(true);
    expect((await (await GET(req("GET", TOKEN_B))).json()).belumDibaca).toBe(1);
    expect(await (await PATCH(req("PATCH", TOKEN_A))).json()).toEqual({ dibaca: 0 });
  });

  it("501 DB_TIDAK_TERSEDIA bila server hanya punya fixture", async () => {
    dbAktif = null;
    for (const res of [await GET(req("GET", TOKEN_A)), await PATCH(req("PATCH", TOKEN_A))]) {
      expect(res.status).toBe(501);
      expect((await res.json()).error.kode).toBe("DB_TIDAK_TERSEDIA");
    }
    dbAktif = t.db;
  });
});
