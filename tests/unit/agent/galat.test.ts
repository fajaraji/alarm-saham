// Penerjemah galat layanan AI: pesan yang menyebutkan apa yang harus
// diperiksa (LLM_BASE_URL / LLM_API_KEY / LLM_MODEL), bukan "coba lagi sesaat"
// yang pernah menutupi kunci/model yang salah selama berhari-hari (2026-10-04).
import { describe, expect, it } from "vitest";

import { petaGalatLayanan, ringkasGalatLayanan } from "../../../src/lib/agent/galat";

describe("petaGalatLayanan", () => {
  it("galat biasa bukan galat layanan → null (jalur fallback 500 milik route)", () => {
    expect(petaGalatLayanan(new Error("galat internal biasa"))).toBeNull();
    expect(petaGalatLayanan("teks")).toBeNull();
    expect(petaGalatLayanan(undefined)).toBeNull();
  });

  it("kunci ditolak (HTTP 401/403) → 503 AI_KUNCI_DITOLAK yang menyebut LLM_API_KEY", () => {
    for (const statusCode of [401, 403]) {
      const g = petaGalatLayanan({ name: "AI_APICallError", statusCode, message: "Unauthorized" });
      expect(g).toMatchObject({ status: 503, kode: "AI_KUNCI_DITOLAK" });
      expect(g!.pesan).toContain("LLM_API_KEY");
      expect(g!.pesan).toContain(`HTTP ${statusCode}`);
    }
  });

  it("model tidak dikenal (HTTP 404) → 503 AI_MODEL_TIDAK_DIKENAL dengan nama model + LLM_MODEL", () => {
    const g = petaGalatLayanan({
      name: "AI_APICallError",
      statusCode: 404,
      message: "model not found",
      requestBodyValues: { model: "rap/gpt-5.6-luna" },
    });
    expect(g).toMatchObject({ status: 503, kode: "AI_MODEL_TIDAK_DIKENAL" });
    expect(g!.pesan).toContain('"rap/gpt-5.6-luna"');
    expect(g!.pesan).toContain("LLM_MODEL");
  });

  it("layanan penuh (HTTP 429) → 503 AI_PENUH", () => {
    expect(petaGalatLayanan({ statusCode: 429, message: "rate limited" })).toMatchObject({
      status: 503,
      kode: "AI_PENUH",
    });
  });

  it("HTTP lain (400/500/502/...) → 503 AI_DITOLAK yang menyebut LLM_BASE_URL dan LLM_MODEL", () => {
    for (const statusCode of [400, 500, 502]) {
      const g = petaGalatLayanan({ statusCode, message: "Bad Gateway" });
      expect(g).toMatchObject({ status: 503, kode: "AI_DITOLAK" });
      expect(g!.pesan).toContain("LLM_BASE_URL");
      expect(g!.pesan).toContain("LLM_MODEL");
    }
  });

  it("galat jaringan (fetch failed / ECONNREFUSED) → 503 AI_TIDAK_BISA_DIHUBUNGI yang menyebut LLM_BASE_URL", () => {
    const undici = new TypeError("fetch failed");
    (undici as { cause?: unknown }).cause = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:9"), {
      code: "ECONNREFUSED",
    });
    const g = petaGalatLayanan(undici);
    expect(g).toMatchObject({ status: 503, kode: "AI_TIDAK_BISA_DIHUBUNGI" });
    expect(g!.pesan).toContain("LLM_BASE_URL");
  });

  it("rantai RetryError/`cause`/`errors` ikut ditelusuri", () => {
    // RetryError: galat asli ada di `lastError`.
    expect(petaGalatLayanan({ name: "AI_RetryError", message: "exhausted", lastError: { statusCode: 401 } })).toMatchObject({
      kode: "AI_KUNCI_DITOLAK",
    });
    // Error biasa dengan `cause` bersatus HTTP.
    const berCause = new Error("wrapped");
    (berCause as { cause?: unknown }).cause = { statusCode: 404, requestBodyValues: { model: "x" } };
    expect(petaGalatLayanan(berCause)).toMatchObject({ kode: "AI_MODEL_TIDAK_DIKENAL" });
    // AggregateError dari undici (`errors` berisi galat jaringan).
    const agregat = Object.assign(new Error("fetch failed"), {
      errors: [Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })],
    });
    expect(petaGalatLayanan(agregat)).toMatchObject({ kode: "AI_TIDAK_BISA_DIHUBUNGI" });
  });

  it("penjaga siklus: rantai yang menunjuk dirinya sendiri tidak menggantung", () => {
    const a: Record<string, unknown> = { message: "loop" };
    a.cause = a;
    expect(petaGalatLayanan(a)).toBeNull();
  });
});

describe("ringkasGalatLayanan", () => {
  it("memuat status HTTP, pesan, dan cuplikan badan respons untuk log server", () => {
    const s = ringkasGalatLayanan({
      statusCode: 401,
      message: "Unauthorized",
      url: "https://gw.example/v1/chat/completions",
      responseBody: '{"error":{"message":"invalid api key"}}',
    });
    expect(s).toContain("HTTP 401");
    expect(s).toContain("Unauthorized");
    expect(s).toContain("invalid api key");
  });

  it("galat biasa tetap punya ringkasan satu baris", () => {
    expect(ringkasGalatLayanan(new Error("oops"))).toContain("oops");
  });
});
