// Route POST /api/backtest: sumber dipilih lewat getEventSource() (Neon → PGlite
// → fixture), satu pintu dengan CLI dan /putar-ulang (temuan tiket 14, diperbaiki
// tiket 13). Di sini getEventSource DITIRU agar unit test tidak membuka ./.pglite
// (satu proses per folder); jalur PGlite nyata dibuktikan e2e (tests/e2e/rakit.spec.ts).
// Tidak butuh kunci AI, nol panggilan API.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "../../../src/app/api/backtest/route";
import aturanDefault from "../../../src/lib/engine/fixtures/aturan-default.json";
import type { BacktestResult } from "../../../src/lib/engine/score";
import { getEventSource } from "../../../src/lib/engine/sumber";

/** Jenis sumber yang "tersedia" di lingkungan tiruan (diubah per tes). */
const lingkungan = vi.hoisted(() => ({ jenis: "fixture" as "fixture" | "pglite" | "neon", tanpaTarget: false }));

vi.mock("../../../src/lib/engine/sumber", async () => {
  const { fromFixture } = await import("../../../src/lib/engine/events");
  const universeKecil = (await import("../../../src/lib/engine/fixtures/universe-kecil.json")).default;
  return {
    getEventSource: vi.fn(async (opsi: { fixture?: boolean } = {}) => {
      const fx = fromFixture(universeKecil);
      const jenis = opsi.fixture ? "fixture" : lingkungan.jenis;
      // Meniru DB nyata: emiten pemantauan khusus tanpa target_event_date (MENN, TGRA, WSKT).
      const universe = lingkungan.tanpaTarget
        ? [...fx.universe, { symbol: "MENN", group: "watchlist" as const, targetEventDate: null }]
        : fx.universe;
      return {
        jenis,
        keterangan: jenis === "fixture" ? "fixture universe-kecil.json (tiruan)" : `${jenis} (tiruan)`,
        source: fx,
        db: null,
        universe: async () => universe,
        tutup: async () => {},
      };
    }),
  };
});

function req(body: unknown, mentah = false): Request {
  return new Request("http://localhost/api/backtest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: mentah ? (body as string) : JSON.stringify(body),
  });
}

beforeEach(() => {
  lingkungan.jenis = "fixture";
  lingkungan.tanpaTarget = false;
  vi.mocked(getEventSource).mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/backtest", () => {
  it("400 bila body bukan JSON atau aturan tidak valid", async () => {
    expect((await POST(req("{", true))).status).toBe(400);
    const res = await POST(req({ rule: { name: "x", combine: "any", blocks: [] } }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.kode).toBe("ATURAN_TIDAK_VALID");
    expect(json.error.rincian[0].path).toBe("rule.blocks");
    expect((await POST(req({ rule: aturanDefault, today: "kemarin" }))).status).toBe(400);
    expect(getEventSource).not.toHaveBeenCalled();
  });

  it("tanpa DB/PGlite: menjalankan aturan default ke fixture dan mengembalikan sumber 'fixture'", async () => {
    const res = await POST(req({ rule: aturanDefault, today: "2026-01-31" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { sumber: string; jenis: string; keterangan: string; hasil: BacktestResult };
    expect(json.sumber).toBe("fixture");
    expect(json.jenis).toBe("fixture");
    expect(json.keterangan).toMatch(/fixture/);
    const h = json.hasil;
    expect(h.today).toBe("2026-01-31");
    expect(h.perSymbol).toHaveLength(8);
    expect(h.perGroup.delisting.total).toBe(3);
    expect(h.perGroup.watchlist.total).toBe(1);
    expect(h.controls).toBe(4);
    // Aturan default (suspensi ATAU laporan hilang ATAU ekuitas negatif) menangkap SRIL & TELE.
    const per = Object.fromEntries(h.perSymbol.map((r) => [r.symbol, r]));
    expect(per.SRIL.fired).toBe(true);
    expect(per.TELE.fired).toBe(true);
    expect(h.hits).toBeGreaterThanOrEqual(2);
    expect(h.falseAlarms).toBeLessThanOrEqual(h.controls);
    // Deterministik: dua panggilan identik → hasil identik.
    const ulang = await (await POST(req({ rule: aturanDefault, today: "2026-01-31" }))).json();
    expect(ulang.hasil).toEqual(h);
  });

  it("PGlite tersedia (DATABASE_URL kosong): getEventSource dipakai dan sumber = 'db' (data Sectors nyata)", async () => {
    vi.stubEnv("DATABASE_URL", "");
    lingkungan.jenis = "pglite";
    const res = await POST(req({ rule: aturanDefault, today: "2026-01-31" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sumber).toBe("db");
    expect(json.jenis).toBe("pglite");
    expect(json.dilewati).toEqual([]);
    expect(getEventSource).toHaveBeenCalledWith({ fixture: false });
  });

  it("emiten kena tanpa target_event_date (MENN) dilewati seperti CLI, bukan 500", async () => {
    lingkungan.jenis = "pglite";
    lingkungan.tanpaTarget = true;
    const res = await POST(req({ rule: aturanDefault, today: "2026-01-31" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { dilewati: string[]; hasil: BacktestResult };
    expect(json.dilewati).toEqual(["MENN"]);
    expect(json.hasil.perSymbol.map((r) => r.symbol)).not.toContain("MENN");
    expect(json.hasil.perSymbol).toHaveLength(8);
  });

  it("Neon tersedia: sumber = 'db', jenis 'neon'", async () => {
    lingkungan.jenis = "neon";
    const json = await (await POST(req({ rule: aturanDefault, today: "2026-01-31" }))).json();
    expect(json).toMatchObject({ sumber: "db", jenis: "neon" });
  });

  it("pakaiFixture: true memaksa fixture walau PGlite/DB ada", async () => {
    lingkungan.jenis = "pglite";
    const json = await (await POST(req({ rule: aturanDefault, today: "2026-01-31", pakaiFixture: true }))).json();
    expect(json).toMatchObject({ sumber: "fixture", jenis: "fixture" });
    expect(getEventSource).toHaveBeenCalledWith({ fixture: true });
  });

  it("aturan 1 blok ketat tetap valid dan berjalan", async () => {
    const res = await POST(
      req({ rule: { name: "Ketat", combine: "all", blocks: [{ kind: "insider_jual", threshold: "ketat" }] }, today: "2026-01-31" }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.hasil.rule).toBe("Ketat");
  });
});
