// Pemilihan provider & model (tiket 08b): 4 kombinasi env, model DeepSeek
// default, providerOptions per provider — tanpa memanggil API mana pun.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AiKeyMissingError,
  hasAiKey,
  idModel,
  instruksiSistem,
  opsiProvider,
  pilihModel,
  pilihProvider,
  providerDari,
} from "../../../src/lib/agent/model";
import { modelTiruan } from "./mock-model";

/** Mulai dari lingkungan bersih: tidak ada kunci, tidak ada pilihan provider. */
beforeEach(() => {
  vi.stubEnv("LLM_PROVIDER", "");
  vi.stubEnv("DEEPSEEK_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("DEEPSEEK_MODEL", "");
  vi.stubEnv("DEEPSEEK_REASONER", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("pilihProvider: 4 kombinasi kunci (LLM_PROVIDER kosong)", () => {
  it("tanpa kunci → AiKeyMissingError menyebut DEEPSEEK_API_KEY dan ANTHROPIC_API_KEY", () => {
    expect(() => pilihProvider()).toThrow(AiKeyMissingError);
    expect(() => pilihProvider()).toThrow(/DEEPSEEK_API_KEY[\s\S]*ANTHROPIC_API_KEY/);
    expect(hasAiKey()).toBe(false);
  });

  it("hanya DEEPSEEK_API_KEY → deepseek", () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-uji");
    expect(pilihProvider()).toBe("deepseek");
    expect(hasAiKey()).toBe(true);
  });

  it("hanya ANTHROPIC_API_KEY → anthropic", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "kunci-uji");
    expect(pilihProvider()).toBe("anthropic");
    expect(hasAiKey()).toBe(true);
  });

  it("kedua kunci ada → deepseek (default)", () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-uji");
    vi.stubEnv("ANTHROPIC_API_KEY", "kunci-uji");
    expect(pilihProvider()).toBe("deepseek");
  });
});

describe("pilihProvider: LLM_PROVIDER eksplisit", () => {
  it("LLM_PROVIDER=anthropic menang walau kedua kunci ada", () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-uji");
    vi.stubEnv("ANTHROPIC_API_KEY", "kunci-uji");
    vi.stubEnv("LLM_PROVIDER", "anthropic");
    expect(pilihProvider()).toBe("anthropic");
  });

  it("LLM_PROVIDER=deepseek tanpa DEEPSEEK_API_KEY → hasAiKey false, pilihModel melempar pesan spesifik", () => {
    vi.stubEnv("LLM_PROVIDER", "deepseek");
    vi.stubEnv("ANTHROPIC_API_KEY", "kunci-uji");
    expect(pilihProvider()).toBe("deepseek");
    expect(hasAiKey()).toBe(false);
    expect(() => pilihModel("penalaran")).toThrow(/DEEPSEEK_API_KEY kosong/);
  });

  it("LLM_PROVIDER asing → AiKeyMissingError menyebut kedua pilihan", () => {
    vi.stubEnv("LLM_PROVIDER", "openai");
    expect(() => pilihProvider()).toThrow(AiKeyMissingError);
    expect(() => pilihProvider()).toThrow(/deepseek.*anthropic/);
    expect(hasAiKey()).toBe(false);
  });
});

describe("pilihModel & idModel", () => {
  it("DeepSeek: model id deepseek-v4-flash untuk kedua peran (tanpa memanggil API)", () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-uji");
    for (const peran of ["penalaran", "ringan"] as const) {
      const model = pilihModel(peran);
      expect(typeof model).not.toBe("string");
      if (typeof model === "string") return;
      expect(model.modelId).toBe("deepseek-v4-flash");
      expect(model.provider).toMatch(/^deepseek/);
    }
  });

  it("DEEPSEEK_MODEL mengganti model; DEEPSEEK_REASONER=1 memakai deepseek-v4-pro hanya untuk penalaran", () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-uji");
    vi.stubEnv("DEEPSEEK_MODEL", "deepseek-v4-pro");
    expect(idModel("deepseek", "penalaran")).toBe("deepseek-v4-pro");
    expect(idModel("deepseek", "ringan")).toBe("deepseek-v4-pro");

    vi.stubEnv("DEEPSEEK_MODEL", "");
    vi.stubEnv("DEEPSEEK_REASONER", "1");
    expect(idModel("deepseek", "penalaran")).toBe("deepseek-v4-pro");
    expect(idModel("deepseek", "ringan")).toBe("deepseek-v4-flash");
    const model = pilihModel("penalaran");
    if (typeof model !== "string") expect(model.modelId).toBe("deepseek-v4-pro");
  });

  it("Anthropic: claude-opus-5 (penalaran) / claude-sonnet-5 (ringan)", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "kunci-uji");
    expect(idModel("anthropic", "penalaran")).toBe("claude-opus-5");
    expect(idModel("anthropic", "ringan")).toBe("claude-sonnet-5");
    const model = pilihModel("ringan");
    if (typeof model !== "string") {
      expect(model.modelId).toBe("claude-sonnet-5");
      expect(model.provider).toMatch(/^anthropic/);
    }
  });

  it("model suntikan selalu menang, walau tanpa kunci", () => {
    const tiruan = modelTiruan([]);
    expect(pilihModel("penalaran", tiruan)).toBe(tiruan);
  });
});

describe("providerDari", () => {
  it("membaca provider dari objek model sungguhan, mengabaikan env", () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-uji");
    vi.stubEnv("ANTHROPIC_API_KEY", "kunci-uji");
    vi.stubEnv("LLM_PROVIDER", "anthropic");
    expect(providerDari(pilihModel("penalaran"))).toBe("anthropic");
    vi.stubEnv("LLM_PROVIDER", "deepseek");
    expect(providerDari(pilihModel("penalaran"))).toBe("deepseek");
  });

  it("model tiruan: ikut LLM_PROVIDER/kunci; tanpa apa pun → deepseek (tidak melempar)", () => {
    const tiruan = modelTiruan([]);
    expect(providerDari(tiruan)).toBe("deepseek");
    vi.stubEnv("ANTHROPIC_API_KEY", "kunci-uji");
    expect(providerDari(tiruan)).toBe("anthropic");
    vi.stubEnv("LLM_PROVIDER", "deepseek");
    expect(providerDari(tiruan)).toBe("deepseek");
  });
});

describe("opsiProvider & instruksiSistem", () => {
  it("DeepSeek: thinking enabled + reasoningEffort, tanpa kunci anthropic; instruksi tanpa cacheControl", () => {
    const opsi = opsiProvider("deepseek", "medium");
    expect(opsi).toEqual({ deepseek: { thinking: { type: "enabled" }, reasoningEffort: "high" } });
    expect(Object.keys(opsi)).toEqual(["deepseek"]);
    expect(opsiProvider("deepseek", "low").deepseek.reasoningEffort).toBe("low");
    expect(opsiProvider("deepseek", "max").deepseek.reasoningEffort).toBe("max");
    const [sistem] = instruksiSistem("teks", "deepseek") as { role: string; providerOptions?: unknown }[];
    expect(sistem.role).toBe("system");
    expect(sistem.providerOptions).toBeUndefined();
  });

  it("Anthropic: thinking adaptive + effort; instruksi dengan cacheControl 1 jam", () => {
    expect(opsiProvider("anthropic", "high")).toEqual({ anthropic: { thinking: { type: "adaptive" }, effort: "high" } });
    const [sistem] = instruksiSistem("teks", "anthropic") as { providerOptions?: unknown }[];
    expect(sistem.providerOptions).toEqual({ anthropic: { cacheControl: { type: "ephemeral", ttl: "1h" } } });
  });
});
