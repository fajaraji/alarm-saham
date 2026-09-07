// Route POST /api/backtest: tanpa DATABASE_URL memakai fixture universe-kecil.
// Tidak butuh kunci AI, nol panggilan API.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "../../../src/app/api/backtest/route";
import aturanDefault from "../../../src/lib/engine/fixtures/aturan-default.json";
import type { BacktestResult } from "../../../src/lib/engine/score";

function req(body: unknown, mentah = false): Request {
  return new Request("http://localhost/api/backtest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: mentah ? (body as string) : JSON.stringify(body),
  });
}

beforeEach(() => vi.stubEnv("DATABASE_URL", ""));
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
  });

  it("menjalankan aturan default ke fixture dan mengembalikan sumber 'fixture'", async () => {
    const res = await POST(req({ rule: aturanDefault, today: "2026-01-31" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { sumber: string; keterangan: string; hasil: BacktestResult };
    expect(json.sumber).toBe("fixture");
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

  it("aturan 1 blok ketat tetap valid dan berjalan", async () => {
    const res = await POST(
      req({ rule: { name: "Ketat", combine: "all", blocks: [{ kind: "insider_jual", threshold: "ketat" }] }, today: "2026-01-31" }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.hasil.rule).toBe("Ketat");
  });
});
