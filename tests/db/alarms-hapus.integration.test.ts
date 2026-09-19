// DELETE /api/alarms (tiket 33) di atas PGlite in-memory: hanya alarm milik
// token pengirim yang terhapus; token lain mendapat 404, bukan menghapus.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Db } from "../../src/lib/db/client";
import { makeTestDb, type TestDb } from "./test-db";

let dbAktif: Db | null = null;
vi.mock("../../src/lib/jaga/penyedia", () => ({
  dbJaga: async () => dbAktif,
  sumberJaga: async () => {
    throw new Error("tidak dipakai di tes ini");
  },
  providerKelasB: () => undefined,
}));

const { DELETE, GET, POST } = await import("../../src/app/api/alarms/route");

const adaPglite = await import("@electric-sql/pglite").then(
  () => true,
  () => false,
);

const TOKEN_A = "3f1c2a8e-7b4d-4c9a-9e1f-0a2b3c4d5e6f";
const TOKEN_B = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const RULE = { name: "Uji hapus", combine: "any", blocks: [{ kind: "suspensi", threshold: "longgar" }] };

function hapus(token: string | null, id: string): Request {
  return new Request(`http://localhost/api/alarms?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: token ? { "x-owner-token": token } : {},
  });
}

async function buat(token: string): Promise<string> {
  const res = await POST(
    new Request("http://localhost/api/alarms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ owner_token: token, name: "Uji hapus", rules: [RULE] }),
    }),
  );
  expect(res.status).toBe(201);
  return (await res.json()).id as string;
}

async function daftar(token: string): Promise<string[]> {
  const res = await GET(new Request("http://localhost/api/alarms", { headers: { "x-owner-token": token } }));
  return ((await res.json()).alarms as { id: string }[]).map((a) => a.id);
}

describe.skipIf(!adaPglite)("DELETE /api/alarms (PGlite in-memory)", () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await makeTestDb("pglite");
    dbAktif = t.db;
  });
  afterAll(async () => {
    dbAktif = null;
    await t.close();
  });

  it("401 tanpa token, 400 bila id bukan UUID", async () => {
    expect((await DELETE(hapus(null, "00000000-0000-4000-8000-000000000001"))).status).toBe(401);
    const r = await DELETE(hapus(TOKEN_A, "bukan-uuid"));
    expect(r.status).toBe(400);
    expect((await r.json()).error.kode).toBe("ID_TIDAK_SAH");
  });

  it("pemilik menghapus alarmnya sendiri; alarm tidak muncul lagi di daftar", async () => {
    const id = await buat(TOKEN_A);
    expect(await daftar(TOKEN_A)).toContain(id);
    const r = await DELETE(hapus(TOKEN_A, id));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ dihapus: id });
    expect(await daftar(TOKEN_A)).not.toContain(id);
  });

  it("token lain mendapat 404 dan alarmnya tetap utuh", async () => {
    const id = await buat(TOKEN_A);
    const r = await DELETE(hapus(TOKEN_B, id));
    expect(r.status).toBe(404);
    expect((await r.json()).error.kode).toBe("ALARM_TIDAK_ADA");
    expect(await daftar(TOKEN_A)).toContain(id);
  });

  it("server tanpa database: 503, bukan galat", async () => {
    const simpan = dbAktif;
    dbAktif = null;
    try {
      expect((await DELETE(hapus(TOKEN_A, "00000000-0000-4000-8000-000000000001"))).status).toBe(503);
    } finally {
      dbAktif = simpan;
    }
  });
});
