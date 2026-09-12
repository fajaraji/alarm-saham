// Route handler App Router: 400 untuk input salah, 503 tanpa kunci AI (DeepSeek/Anthropic).
// Tidak ada panggilan model — semua kasus berhenti sebelum memanggil AI.
import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as diagnosisPost } from "../../../src/app/api/agent/diagnosis/route";
import { POST as rakitPost } from "../../../src/app/api/agent/rakit/route";

afterEach(() => vi.unstubAllEnvs());

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
