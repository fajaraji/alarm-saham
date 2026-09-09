// Perakit blok dengan model tiruan: 3 kalimat contoh → aturan valid; kalimat
// di luar domain dan permintaan rekomendasi ditolak; guard menyensor keluaran.
// Provider default tes: DeepSeek (structured output tanpa opsi Anthropic).
import { afterEach, describe, expect, it, vi } from "vitest";

import { DISCLAIMER } from "../../../src/lib/agent/instructions";
import { AiKeyMissingError } from "../../../src/lib/agent/model";
import { rakitAturan, RakitError } from "../../../src/lib/agent/rakit";
import { parseRule, type Rule } from "../../../src/lib/engine/rules";
import { langkahTeks, modelTiruan } from "./mock-model";

afterEach(() => vi.unstubAllEnvs());

const diterima = (rule: Rule, alasan: string) => langkahTeks({ ditolak: false, pesan: null, rule, alasan });
const ditolak = (pesan: string) => langkahTeks({ ditolak: true, pesan, rule: null, alasan: null });

const CONTOH: { kalimat: string; rule: Rule; alasan: string }[] = [
  {
    kalimat: "aku mau alarm buat saham yang mau pailit",
    rule: {
      name: "Saham mau pailit",
      combine: "any",
      blocks: [
        { kind: "suspensi", threshold: "longgar" },
        { kind: "laporan_hilang", threshold: "longgar" },
        { kind: "ekuitas_negatif", threshold: "longgar" },
      ],
    },
    alasan: "Saham yang mau pailit biasanya disuspensi, berhenti lapor, atau utangnya melebihi harta.",
  },
  {
    kalimat: "kasih tahu kalau pemilik jual saham",
    rule: { name: "Orang dalam melepas saham", combine: "any", blocks: [{ kind: "insider_jual", threshold: "longgar" }] },
    alasan: "Pemilik atau orang dalam yang melepas saham terekam di data filing.",
  },
  {
    kalimat: "alarm buat saham yang berhenti lapor keuangan",
    rule: { name: "Berhenti lapor keuangan", combine: "any", blocks: [{ kind: "laporan_hilang", threshold: "longgar" }] },
    alasan: "Laporan kuartalan yang tidak muncul 120 hari setelah periode dianggap hilang.",
  },
];

describe("rakitAturan: kalimat contoh → aturan valid", () => {
  for (const c of CONTOH) {
    it(`"${c.kalimat}"`, async () => {
      vi.stubEnv("LLM_PROVIDER", "deepseek");
      const model = modelTiruan([diterima(c.rule, c.alasan)]);
      const hasil = await rakitAturan(c.kalimat, { model });
      expect(hasil.ditolak).toBe(false);
      if (hasil.ditolak) return;
      expect(() => parseRule(hasil.rule)).not.toThrow();
      expect(hasil.rule).toEqual(c.rule);
      expect(hasil.alasan).toBe(c.alasan);
      expect(hasil.perluTinjau).toBe(false);
      expect(hasil.usage).toMatchObject({ inputTokens: 100, outputTokens: 20, cacheReadTokens: 40 });

      // Panggilan ke model: instruksi sistem (tanpa cacheControl Anthropic — DeepSeek
      // meng-cache otomatis), kalimat di prompt, structured output (responseFormat
      // json), thinking DeepSeek; tidak ada kunci "anthropic" di providerOptions.
      const call = model.doGenerateCalls[0];
      const sistem = call.prompt[0];
      expect(sistem.role).toBe("system");
      expect(sistem.content).toContain(DISCLAIMER);
      expect(sistem.providerOptions).toBeUndefined();
      expect(JSON.stringify(call.prompt[1])).toContain(c.kalimat);
      expect(call.responseFormat?.type).toBe("json");
      expect(JSON.stringify(call.responseFormat)).toContain('"suspensi"');
      expect(call.providerOptions).toEqual({ deepseek: { thinking: { type: "enabled" }, reasoningEffort: "high" } });
      expect(JSON.stringify({ sistem: sistem.providerOptions, call: call.providerOptions })).not.toContain("anthropic");
    });
  }
});

describe("rakitAturan: provider Anthropic", () => {
  it("LLM_PROVIDER=anthropic → cacheControl pada instruksi + thinking adaptive, tanpa kunci deepseek", async () => {
    vi.stubEnv("LLM_PROVIDER", "anthropic");
    const c = CONTOH[0];
    const model = modelTiruan([diterima(c.rule, c.alasan)]);
    const hasil = await rakitAturan(c.kalimat, { model });
    expect(hasil.ditolak).toBe(false);
    const call = model.doGenerateCalls[0];
    expect(call.prompt[0].providerOptions).toEqual({ anthropic: { cacheControl: { type: "ephemeral", ttl: "1h" } } });
    expect(call.providerOptions).toEqual({ anthropic: { thinking: { type: "adaptive" }, effort: "medium" } });
    expect(JSON.stringify(call.providerOptions)).not.toContain("deepseek");
  });
});

describe("rakitAturan: penolakan sopan", () => {
  it("kalimat di luar domain ditolak", async () => {
    const pesan = "Maaf, saya hanya bisa merakit alarm saham; resep rendang di luar kemampuan saya.";
    const hasil = await rakitAturan("resep rendang yang enak", { model: modelTiruan([ditolak(pesan)]) });
    expect(hasil).toMatchObject({ ditolak: true, pesan, perluTinjau: false });
  });

  it("permintaan rekomendasi ditolak dengan penjelasan", async () => {
    const pesan =
      "Alarm Saham hanya membuat peringatan berbasis data, bukan saran investasi, jadi saya tidak bisa menebak saham yang akan naik.";
    const hasil = await rakitAturan("saham apa yang bakal naik minggu depan?", { model: modelTiruan([ditolak(pesan)]) });
    expect(hasil.ditolak).toBe(true);
    if (hasil.ditolak) expect(hasil.pesan).toBe(pesan);
  });

  it("pesan penolakan kosong diganti pesan baku", async () => {
    const hasil = await rakitAturan("apa kabar", { model: modelTiruan([ditolak("")]) });
    expect(hasil.ditolak).toBe(true);
    if (hasil.ditolak) expect(hasil.pesan).toMatch(/tidak bisa dijadikan alarm/);
  });
});

describe("rakitAturan: pengaman", () => {
  it("guard menyensor kata rekomendasi pada alasan/nama dan menandai perluTinjau", async () => {
    const rule: Rule = { name: "Sinyal beli murah", combine: "any", blocks: [{ kind: "suspensi", threshold: "longgar" }] };
    const hasil = await rakitAturan("alarm saham digembok", {
      model: modelTiruan([diterima(rule, "Kalau disuspensi sebaiknya jual dulu.")]),
    });
    expect(hasil.ditolak).toBe(false);
    if (hasil.ditolak) return;
    // Nama aturan pun dibuang seluruhnya: "Sinyal [dihapus] murah" masih
    // terbaca sebagai ajakan bertransaksi.
    expect(hasil.rule.name).toBe("[kalimat saran dihapus]");
    // Kalimat beranjuran ("sebaiknya … jual") dibuang seluruhnya, bukan hanya katanya:
    // mengganti kata saja menyisakan bingkai saran yang utuh.
    expect(hasil.alasan).toBe("[kalimat saran dihapus].");
    expect(hasil.perluTinjau).toBe(true);
    expect(hasil.kataDisensor.sort()).toEqual(["beli", "jual"]);
  });

  it("aturan tidak valid dari model → RakitError (bukan aturan rusak lolos)", async () => {
    const rusak = { name: "x", combine: "any", blocks: [{ kind: "suspensi", threshold: "longgar" }, { kind: "suspensi", threshold: "ketat" }] };
    await expect(
      rakitAturan("alarm suspensi ganda", { model: modelTiruan([langkahTeks({ ditolak: false, pesan: null, rule: rusak, alasan: "x" })]) }),
    ).rejects.toBeInstanceOf(RakitError);
  });

  it("kalimat kosong / terlalu panjang ditolak sebelum memanggil model", async () => {
    const model = modelTiruan([ditolak("x")]);
    await expect(rakitAturan("   ", { model })).rejects.toBeInstanceOf(RakitError);
    await expect(rakitAturan("a".repeat(501), { model })).rejects.toBeInstanceOf(RakitError);
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it("tanpa kunci provider mana pun dan tanpa model suntikan → AiKeyMissingError menyebut kedua opsi", async () => {
    vi.stubEnv("LLM_PROVIDER", "");
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const janji = rakitAturan("alarm saham pailit");
    await expect(janji).rejects.toBeInstanceOf(AiKeyMissingError);
    await expect(janji).rejects.toThrow(/DEEPSEEK_API_KEY[\s\S]*ANTHROPIC_API_KEY/);
  });
});
