// Route POST /api/alarms: validasi input; 503 DB_TIDAK_TERSEDIA bila server
// tanpa database (klien jatuh ke localStorage). Tidak menyentuh DB sungguhan:
// `dbJaga()` (penentu yang sama dengan /api/portofolio: Neon, lalu PGlite
// lokal) ditiru mengembalikan null, supaya hasil tes tidak bergantung pada ada
// tidaknya folder .pglite di mesin yang menjalankannya.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/lib/jaga/penyedia", () => ({ dbJaga: async () => null }));

const { GET, POST } = await import("../../../src/app/api/alarms/route");

afterEach(() => vi.unstubAllEnvs());

function req(body: unknown, mentah = false): Request {
  return new Request("http://localhost/api/alarms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: mentah ? (body as string) : JSON.stringify(body),
  });
}

const RULE = { name: "Alarm uji", combine: "any", blocks: [{ kind: "suspensi", threshold: "longgar" }] };
const TOKEN = "3f1c2a8e-7b4d-4c9a-9e1f-0a2b3c4d5e6f";

describe("POST /api/alarms", () => {
  it("400 bila body bukan JSON", async () => {
    expect((await POST(req("{", true))).status).toBe(400);
  });

  it("400 bila token pendek, nama kosong, atau aturan tidak valid", async () => {
    const kasus = [
      { owner_token: "abc", name: "x", rules: [RULE] },
      { owner_token: TOKEN, name: "  ", rules: [RULE] },
      { owner_token: TOKEN, name: "x", rules: [] },
      { owner_token: TOKEN, name: "x", rules: [{ ...RULE, blocks: [RULE.blocks[0], RULE.blocks[0]] }] },
    ];
    for (const body of kasus) {
      const res = await POST(req(body));
      expect(res.status).toBe(400);
      expect((await res.json()).error.kode).toBe("INPUT_TIDAK_VALID");
    }
  });

  it("503 DB_TIDAK_TERSEDIA bila server tanpa database (input valid)", async () => {
    const res = await POST(req({ owner_token: TOKEN, name: "Alarm uji", rules: [RULE], last_score: { hits: 2, total: 3 } }));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error.kode).toBe("DB_TIDAK_TERSEDIA");
    expect(json.error.pesan).toMatch(/browser/);
  });
});

describe("GET /api/alarms", () => {
  it("401 tanpa token, 503 tanpa database", async () => {
    expect((await GET(new Request("http://localhost/api/alarms"))).status).toBe(401);
    const res = await GET(new Request("http://localhost/api/alarms", { headers: { "x-owner-token": TOKEN } }));
    expect(res.status).toBe(503);
  });
});
