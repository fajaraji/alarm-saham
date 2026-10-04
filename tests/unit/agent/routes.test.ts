// Route handler App Router: 400 untuk input salah, 503 tanpa kunci AI (DeepSeek/Anthropic),
// dan galat layanan AI yang terbaca (bukan "coba lagi sesaat"). Nol panggilan
// model sungguhan — galat layanan disuntik lewat tiruan `diagnosis`/`rakitAturan`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as diagnosisPost } from "../../../src/app/api/agent/diagnosis/route";
import { POST as rakitPost } from "../../../src/app/api/agent/rakit/route";

const tiruan = vi.hoisted(() => ({ diagnosis: vi.fn(), rakitAturan: vi.fn() }));

vi.mock("../../../src/lib/agent", async (asli) => {
  const mod = await asli<typeof import("../../../src/lib/agent")>();
  return { ...mod, diagnosis: tiruan.diagnosis, rakitAturan: tiruan.rakitAturan };
});

beforeEach(() => {
  tiruan.diagnosis.mockReset();
  tiruan.rakitAturan.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function req(body: unknown, mentah = false): Request {
  return new Request("http://localhost/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: mentah ? (body as string) : JSON.stringify(body),
  });
}

const ATURAN = { name: "Uji", combine: "any", blocks: [{ kind: "laporan_hilang", threshold: "longgar" }] };

describe("POST /api/agent/rakit", () => {
  it("400 bila body bukan JSON", async () => {
    const res = await rakitPost(req("{bukan json", true));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { kode: "BODY_BUKAN_JSON" } });
  });

  it("400 bila kalimat hilang/terlalu pendek", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "kunci-uji");
    for (const body of [{}, { kalimat: 12 }, { kalimat: "ab" }]) {
      const res = await rakitPost(req(body));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.kode).toBe("INPUT_TIDAK_VALID");
      expect(json.error.rincian[0].path).toBe("kalimat");
    }
  });

  it("503 dengan pesan jelas bila tidak ada kunci provider mana pun", async () => {
    vi.stubEnv("LLM_PROVIDER", "");
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const res = await rakitPost(req({ kalimat: "aku mau alarm buat saham yang mau pailit" }));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error.kode).toBe("AI_TIDAK_TERSEDIA");
    expect(json.error.pesan).toMatch(/DEEPSEEK_API_KEY/);
    expect(json.error.pesan).toMatch(/ANTHROPIC_API_KEY/);
  });
});

describe("POST /api/agent/diagnosis", () => {
  it("400 bila body bukan JSON", async () => {
    const res = await diagnosisPost(req("[", true));
    expect(res.status).toBe(400);
  });

  it("400 bila aturan tidak valid (blok ganda / kind asing / tanpa rule)", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "kunci-uji");
    const kasus = [
      {},
      { rule: { ...ATURAN, blocks: [] } },
      { rule: { ...ATURAN, blocks: [{ kind: "harga_turun", threshold: "longgar" }] } },
      { rule: { ...ATURAN, blocks: [ATURAN.blocks[0], ATURAN.blocks[0]] } },
      { rule: ATURAN, targetSymbol: "X" },
      { rule: ATURAN, backtest: { hits: "dua" } },
    ];
    for (const body of kasus) {
      const res = await diagnosisPost(req(body));
      expect(res.status).toBe(400);
      expect((await res.json()).error.kode).toBe("INPUT_TIDAK_VALID");
    }
  });

  it("503 bila tidak ada kunci provider (input valid)", async () => {
    vi.stubEnv("LLM_PROVIDER", "");
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const res = await diagnosisPost(req({ rule: ATURAN, targetSymbol: "tele" }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatchObject({ kode: "AI_TIDAK_TERSEDIA" });
  });
});

describe("galat layanan AI terbaca, bukan 'coba lagi sesaat'", () => {
  // Bentuk minimal BacktestResult yang lolos BacktestSchema.
  const BACKTEST = { rule: "Uji", scanStart: "2020-01-31", today: "2026-09-07", hits: 0, total: 1, falseAlarms: 0, controls: 1, perSymbol: [] };

  it("diagnosis: kunci ditolak gateway → 503 AI_KUNCI_DITOLAK yang menyebut LLM_API_KEY", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("ANTHROPIC_API_KEY", "kunci-uji");
    tiruan.diagnosis.mockRejectedValue({ name: "AI_APICallError", statusCode: 401, message: "Unauthorized" });
    const res = await diagnosisPost(req({ rule: ATURAN, backtest: BACKTEST, pakaiFixture: true }));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error.kode).toBe("AI_KUNCI_DITOLAK");
    expect(json.error.pesan).toContain("LLM_API_KEY");
  });

  it("diagnosis: model tidak dikenal → 503 AI_MODEL_TIDAK_DIKENAL yang menyebut LLM_MODEL", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("ANTHROPIC_API_KEY", "kunci-uji");
    tiruan.diagnosis.mockRejectedValue({ statusCode: 404, requestBodyValues: { model: "rap/gpt-5.6-luna" } });
    const res = await diagnosisPost(req({ rule: ATURAN, backtest: BACKTEST, pakaiFixture: true }));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error.kode).toBe("AI_MODEL_TIDAK_DIKENAL");
    expect(json.error.pesan).toContain("LLM_MODEL");
    expect(json.error.pesan).toContain("rap/gpt-5.6-luna");
  });

  it("diagnosis: galat tak dikenal tetap 500 GALAT_INTERNAL", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("ANTHROPIC_API_KEY", "kunci-uji");
    tiruan.diagnosis.mockRejectedValue(new Error("kejutan di dalam"));
    const res = await diagnosisPost(req({ rule: ATURAN, backtest: BACKTEST, pakaiFixture: true }));
    expect(res.status).toBe(500);
    expect((await res.json()).error.kode).toBe("GALAT_INTERNAL");
  });

  it("rakit: galat jaringan → 503 AI_TIDAK_BISA_DIHUBUNGI yang menyebut LLM_BASE_URL", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("ANTHROPIC_API_KEY", "kunci-uji");
    const undici = new TypeError("fetch failed");
    (undici as { cause?: unknown }).cause = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
    tiruan.rakitAturan.mockRejectedValue(undici);
    const res = await rakitPost(req({ kalimat: "alarm untuk saham yang mau pailit" }));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error.kode).toBe("AI_TIDAK_BISA_DIHUBUNGI");
    expect(json.error.pesan).toContain("LLM_BASE_URL");
  });
});
