// Route /api/portofolio di atas PGlite in-memory: simpan → muat (per token),
// saham ganda ditolak, hapus; 501 bila server tanpa DB. Tanpa panggilan API.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Db } from "../../src/lib/db/client";
import { makeTestDb, type TestDb } from "./test-db";

// Route mengambil DB lewat `dbJaga()`; di tes diarahkan ke PGlite in-memory (atau null → 501).
let dbAktif: Db | null = null;
vi.mock("../../src/lib/jaga/penyedia", () => ({
  dbJaga: async () => dbAktif,
  sumberJaga: async () => {
    throw new Error("tidak dipakai di tes ini");
  },
  providerKelasB: () => undefined,
}));

const { DELETE, GET, POST } = await import("../../src/app/api/portofolio/route");

const adaPglite = await import("@electric-sql/pglite").then(
  () => true,
  () => false,
);
if (!adaPglite) console.warn("[portofolio] Tes route DI-SKIP: @electric-sql/pglite tidak terpasang.");

const TOKEN_A = "3f1c2a8e-7b4d-4c9a-9e1f-0a2b3c4d5e6f";
const TOKEN_B = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const ALARM = "00000000-0000-4000-8000-00000000a001";

function req(method: string, token: string | null, body?: unknown): Request {
  return new Request("http://localhost/api/portofolio", {
    method,
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(token ? { "x-owner-token": token } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe.skipIf(!adaPglite)("/api/portofolio (PGlite in-memory)", () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await makeTestDb("pglite");
    dbAktif = t.db;
  });
  afterAll(async () => {
    dbAktif = null;
    await t.close();
  });

  it("401 tanpa header x-owner-token", async () => {
    expect((await GET(req("GET", null))).status).toBe(401);
    expect((await POST(req("POST", "pendek", { symbols: ["BBCA"] }))).status).toBe(401);
  });

  it("GET kosong → null; POST simpan → GET memuat (hanya untuk token yang sama)", async () => {
    expect(await (await GET(req("GET", TOKEN_A))).json()).toEqual({ portofolio: null });

    const res = await POST(req("POST", TOKEN_A, { symbols: ["bbca", "SRIL.JK"], alarmIds: [ALARM] }));
    expect(res.status).toBe(200);
    const { portofolio } = await res.json();
    expect(portofolio.symbols).toEqual(["BBCA", "SRIL"]);
    expect(portofolio.alarmIds).toEqual([ALARM]);
    expect(portofolio.id).toMatch(/^[0-9a-f-]{36}$/);

    const muat = await (await GET(req("GET", TOKEN_A))).json();
    expect(muat.portofolio.id).toBe(portofolio.id);
    expect(muat.portofolio.symbols).toEqual(["BBCA", "SRIL"]);
    expect(await (await GET(req("GET", TOKEN_B))).json()).toEqual({ portofolio: null });
  });

  it("POST kedua = memperbarui baris yang sama (bukan menambah)", async () => {
    const a = await (await POST(req("POST", TOKEN_A, { symbols: ["BBCA"] }))).json();
    const b = await (await GET(req("GET", TOKEN_A))).json();
    expect(b.portofolio.id).toBe(a.portofolio.id);
    expect(b.portofolio.symbols).toEqual(["BBCA"]);
    expect(b.portofolio.alarmIds).toEqual([]);
  });

  it("saham ganda ditolak 400 SAHAM_GANDA; kode bukan 4 huruf → 400 INPUT_TIDAK_VALID", async () => {
    const ganda = await POST(req("POST", TOKEN_A, { symbols: ["BBCA", "bbca"] }));
    expect(ganda.status).toBe(400);
    const json = await ganda.json();
    expect(json.error.kode).toBe("SAHAM_GANDA");
    expect(json.error.rincian).toEqual(["BBCA"]);

    const salah = await POST(req("POST", TOKEN_A, { symbols: ["BB"] }));
    expect(salah.status).toBe(400);
    expect((await salah.json()).error.kode).toBe("INPUT_TIDAK_VALID");
    // Portofolio lama tidak berubah.
    expect((await (await GET(req("GET", TOKEN_A))).json()).portofolio.symbols).toEqual(["BBCA"]);
  });

  it("DELETE menghapus milik token itu saja", async () => {
    await POST(req("POST", TOKEN_B, { symbols: ["WIKA"] }));
    expect(await (await DELETE(req("DELETE", TOKEN_A))).json()).toEqual({ dihapus: 1 });
    expect(await (await GET(req("GET", TOKEN_A))).json()).toEqual({ portofolio: null });
    expect((await (await GET(req("GET", TOKEN_B))).json()).portofolio.symbols).toEqual(["WIKA"]);
  });

  it("501 DB_TIDAK_TERSEDIA bila server hanya punya fixture", async () => {
    dbAktif = null;
    for (const res of [await GET(req("GET", TOKEN_A)), await POST(req("POST", TOKEN_A, { symbols: ["BBCA"] })), await DELETE(req("DELETE", TOKEN_A))]) {
      expect(res.status).toBe(501);
      expect((await res.json()).error.kode).toBe("DB_TIDAK_TERSEDIA");
    }
    dbAktif = t.db;
  });
});
