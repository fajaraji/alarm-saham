// Diagnosis dengan model tiruan: loop tool-use (≥2 tool), trace dari tool call
// sungguhan, usulan blok terstruktur, guard, dan penyimpan trace yang disuntik.
// Provider default tes: DeepSeek (tool-calling tanpa opsi Anthropic).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { diagnosis, MAKS_USULAN, type RekamanRun } from "../../../src/lib/agent/diagnosis";
import { DISCLAIMER } from "../../../src/lib/agent/instructions";
import { fromFixture } from "../../../src/lib/engine/events";
import universeKecil from "../../../src/lib/engine/fixtures/universe-kecil.json";
import type { Rule } from "../../../src/lib/engine/rules";
import { runBacktest } from "../../../src/lib/engine/score";
import { langkahTeks, langkahTool, modelTiruan } from "./mock-model";

const sumber = fromFixture(universeKecil);
const TODAY = "2026-09-07";
const rule: Rule = { name: "Laporan hilang saja", combine: "any", blocks: [{ kind: "laporan_hilang", threshold: "longgar" }] };
const backtest = await runBacktest(rule, sumber.universe, sumber, { today: TODAY });

beforeEach(() => vi.stubEnv("LLM_PROVIDER", "deepseek"));
afterEach(() => vi.unstubAllEnvs());

const JAWABAN = {
  ringkasan:
    "Alarm hanya memakai blok laporan hilang, sedangkan TELE masih rajin melapor sampai kuartal terakhir sebelum kejadian. Menambah blok suspensi akan menangkapnya lebih awal.",
  emitenDibahas: [
    {
      symbol: "TELE",
      sebab: "Kuartal laporan lengkap sampai 2025-03-31; suspensi 2024-12-27 tidak tercakup blok laporan hilang.",
      buktiTanggal: ["2024-12-27", "2025-03-31"],
    },
  ],
  usulanBlok: [
    { kind: "suspensi", threshold: "longgar", alasan: "Suspensi 2024-12-27 terjadi 5 bulan sebelum target 2025-06-06." },
    { kind: "ekuitas_negatif", threshold: "longgar", alasan: "Ekuitas TELE sudah negatif pada kuartal sebelum kejadian." },
    { kind: "insider_jual", threshold: "ketat", alasan: "usulan ketiga harus dibuang" },
  ],
};

describe("kasus tele: aturan laporan_hilang saja bolong", () => {
  it("backtest fixture: TELE dan WIKA terlewat", () => {
    const terlewat = backtest.perSymbol.filter((r) => r.group !== "control" && !r.fired).map((r) => r.symbol);
    expect(terlewat).toEqual(expect.arrayContaining(["TELE", "WIKA"]));
    expect(backtest.falseAlarms).toBe(0);
  });
});

describe("diagnosis (model tiruan)", () => {
  it("memanggil ≥2 tool, trace mengikuti tool call sungguhan, usulan blok terstruktur", async () => {
    const model = modelTiruan([
      langkahTool([{ toolName: "listMissed", input: {} }, { toolName: "getSuspensions", input: { symbol: "tele" } }]),
      langkahTool([
        { toolName: "runAlarmOn", input: { symbol: "TELE", t: "2025-05-31", blocks: null, combine: null } },
        { toolName: "getReportDates", input: { symbol: "TELE" } },
        {
          toolName: "runAlarmOn",
          input: { symbol: "TELE", t: "2025-05-31", blocks: [{ kind: "suspensi", threshold: "longgar" }], combine: null },
        },
      ]),
      langkahTeks(JAWABAN),
    ]);
    const rekaman: RekamanRun[] = [];
    const hasil = await diagnosis({
      rule,
      backtest,
      source: sumber,
      model,
      targetSymbol: "TELE",
      simpan: async (r) => {
        rekaman.push(r);
        return "run-uji-1";
      },
    });

    // Keluaran terstruktur
    expect(hasil.ringkasan).toBe(JAWABAN.ringkasan);
    expect(hasil.emitenDibahas).toEqual(JAWABAN.emitenDibahas);
    expect(hasil.usulanBlok).toHaveLength(MAKS_USULAN);
    expect(hasil.usulanBlok[0]).toEqual({ kind: "suspensi", threshold: "longgar", alasan: expect.any(String) });
    expect(hasil.perluTinjau).toBe(false);
    expect(hasil.langkah).toBe(3);
    expect(hasil.runId).toBe("run-uji-1");
    expect(hasil.usage).toMatchObject({ inputTokens: 300, outputTokens: 60, totalTokens: 360, cacheReadTokens: 120 });

    // Trace = tool call sungguhan per langkah (bukan karangan model)
    expect(hasil.trace.map((t) => [t.step, t.tool])).toEqual([
      [0, "listMissed"],
      [0, "getSuspensions"],
      [1, "runAlarmOn"],
      [1, "getReportDates"],
      [1, "runAlarmOn"],
    ]);
    expect(hasil.trace[0].ringkasanHasil).toMatch(/terlewat: .*TELE.*WIKA/);
    expect(hasil.trace[1].input).toEqual({ symbol: "TELE" }); // .trim().toUpperCase() di skema tool
    expect(hasil.trace[1].ringkasanHasil).toBe("1 suspensi: 2024-12-27");
    expect(hasil.trace[2].ringkasanHasil).toMatch(/^TELE @ 2025-05-31 \[laporan_hilang\(longgar\)\] → diam$/);
    expect(hasil.trace[3].ringkasanHasil).toMatch(/kuartal tersedia \(2020-03-31 \.\. 2025-06-30\)/);
    expect(hasil.trace[4].ringkasanHasil).toMatch(/\[suspensi\(longgar\)\] → BERBUNYI; suspensi: suspensi 2024-12-27/);

    // Penyimpan menerima trace + keluaran yang sama
    expect(rekaman).toHaveLength(1);
    expect(rekaman[0].trace).toEqual(hasil.trace);
    expect(rekaman[0].keluaran.usulanBlok).toHaveLength(2);
    expect(rekaman[0].rule).toBe(rule);

    // Panggilan model: 3 langkah, instruksi sistem tanpa opsi Anthropic (DeepSeek
    // meng-cache otomatis), tools terdaftar, thinking DeepSeek
    expect(model.doGenerateCalls).toHaveLength(3);
    const call = model.doGenerateCalls[0];
    expect(call.prompt[0]).toMatchObject({ role: "system" });
    expect(call.prompt[0].providerOptions).toBeUndefined();
    expect(String(call.prompt[0].content)).toContain(DISCLAIMER);
    expect(call.tools?.map((t) => t.name).sort()).toEqual([
      "getCorporateActions",
      "getFilings",
      "getFinancials",
      "getReportDates",
      "getSuspensions",
      "listMissed",
      "runAlarmOn",
    ]);
    expect(call.providerOptions).toEqual({ deepseek: { thinking: { type: "enabled" }, reasoningEffort: "high" } });
    expect(JSON.stringify(model.doGenerateCalls.map((c) => c.providerOptions))).not.toContain("anthropic");
    expect(JSON.stringify(call.prompt[1])).toContain("Fokuskan pembahasan pada emiten TELE");
    // Hasil tool langkah 1 dikirim balik ke model pada langkah 2
    const pesanTool = model.doGenerateCalls[1].prompt.filter((m) => m.role === "tool");
    expect(pesanTool.length).toBeGreaterThan(0);
    expect(JSON.stringify(pesanTool)).toContain("2024-12-27");
  });

  it("guard menyensor kata rekomendasi pada teks model, bukan pada kind/symbol", async () => {
    const model = modelTiruan([
      langkahTool([{ toolName: "listMissed", input: {} }, { toolName: "getFinancials", input: { symbol: "TELE" } }]),
      langkahTeks({
        ringkasan: "Alarm bolong. Sebaiknya jual saham ini.",
        emitenDibahas: [{ symbol: "TELE", sebab: "buy the dip", buktiTanggal: ["2025-03-31"] }],
        usulanBlok: [{ kind: "insider_jual", threshold: "longgar", alasan: "orang dalam menjual (filing jual)" }],
      }),
    ]);
    const hasil = await diagnosis({ rule, backtest, source: sumber, model, simpan: async () => undefined });
    expect(hasil.perluTinjau).toBe(true);
    expect(hasil.kataDisensor.sort()).toEqual(["buy", "jual"]);
    // Kalimat "Sebaiknya [dihapus] saham ini" masih terbaca sebagai saran walau
    // katanya sudah diganti, jadi kalimatnya dibuang seluruhnya.
    expect(hasil.ringkasan).toBe("Alarm bolong. [kalimat saran dihapus].");
    expect(hasil.emitenDibahas[0].sebab).toBe("[dihapus] the dip");
    expect(hasil.usulanBlok[0]).toEqual({ kind: "insider_jual", threshold: "longgar", alasan: "orang dalam menjual (filing jual)" });
    expect(hasil.runId).toBeUndefined();
    expect(hasil.trace).toHaveLength(2);
  });

  it("tool getFilings/getCorporateActions/getFinancials meringkas hasil; galat input tool tercatat di trace", async () => {
    const model = modelTiruan([
      langkahTool([
        { toolName: "getFilings", input: { symbol: "SRIL" } },
        { toolName: "getCorporateActions", input: { symbol: "WIKA" } },
        { toolName: "getFinancials", input: { symbol: "SRIL" } },
        { toolName: "runAlarmOn", input: { symbol: "SRIL", t: "bukan-tanggal", blocks: null, combine: null } },
      ]),
      langkahTeks({ ringkasan: "ok", emitenDibahas: [], usulanBlok: [] }),
    ]);
    const hasil = await diagnosis({ rule, backtest, source: sumber, model, simpan: async () => undefined });
    const peta = Object.fromEntries(hasil.trace.map((t) => [t.tool, t.ringkasanHasil]));
    expect(peta.getFilings).toMatch(/^\d+ filing \(\d+ tipe jual\)$/);
    expect(peta.getCorporateActions).toMatch(/^\d+ rights issue/);
    expect(peta.getFinancials).toMatch(/kuartal keuangan; terakhir \d{4}-\d{2}-\d{2} ekuitas/);
    expect(peta.runAlarmOn).toMatch(/^GALAT: /);
    expect(hasil.usulanBlok).toEqual([]);
  });

  it("provider Anthropic: tool-calling tetap jalan, instruksi di-cache, thinking adaptive", async () => {
    vi.stubEnv("LLM_PROVIDER", "anthropic");
    const model = modelTiruan([
      langkahTool([{ toolName: "listMissed", input: {} }]),
      langkahTeks({ ringkasan: "ok", emitenDibahas: [], usulanBlok: [] }),
    ]);
    const hasil = await diagnosis({ rule, backtest, source: sumber, model, simpan: async () => undefined });
    expect(hasil.trace.map((t) => t.tool)).toEqual(["listMissed"]);
    const call = model.doGenerateCalls[0];
    expect(call.prompt[0].providerOptions).toEqual({ anthropic: { cacheControl: { type: "ephemeral", ttl: "1h" } } });
    expect(call.providerOptions).toEqual({ anthropic: { thinking: { type: "adaptive" }, effort: "high" } });
  });

  it("stopWhen membatasi langkah: model yang terus memanggil tool berhenti di maxSteps", async () => {
    const model = modelTiruan([langkahTool([{ toolName: "listMissed", input: {} }])]);
    await expect(
      diagnosis({ rule, backtest, source: sumber, model, maxSteps: 3, simpan: async () => undefined }),
    ).rejects.toThrow();
    expect(model.doGenerateCalls).toHaveLength(3);
  });
});
