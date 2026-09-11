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
import { langkahProsa, langkahTeks, langkahTool, modelTiruan, usageTiruan } from "./mock-model";

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
    expect(hasil.usulanBlok[0]).toEqual({
      kind: "suspensi",
      threshold: "longgar",
      alasan: expect.any(String),
      perluTinjau: false,
    });
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

  it("backstop meredaksi FRASA di ringkasan/sebab, dan hanya MENANDAI alasan usulan blok", async () => {
    // Rancang-ulang putaran 5: `alasan` tidak boleh digunting, karena penyerang
    // membuktikan kedua alasan bisa hilang sekaligus sehingga panel memasang
    // usulan blok tanpa alasan — justru nilai jual produk.
    const model = modelTiruan([
      langkahTool([{ toolName: "listMissed", input: {} }, { toolName: "getFinancials", input: { symbol: "TELE" } }]),
      langkahTeks({
        ringkasan: "Alarm bolong sejak 2021-05-18. Sebaiknya jual saham ini.",
        emitenDibahas: [{ symbol: "TELE", sebab: "ekuitas negatif; cut loss saja", buktiTanggal: ["2025-03-31"] }],
        usulanBlok: [
          { kind: "insider_jual", threshold: "longgar", alasan: "orang dalam menjual (filing jual)" },
          { kind: "laporan_hilang", threshold: "ketat", alasan: "Ekuitas minus Rp1,1 triliun; kurangi porsimu di TELE." },
        ],
      }),
    ]);
    const hasil = await diagnosis({ rule, backtest, source: sumber, model, simpan: async () => undefined });
    expect(hasil.perluTinjau).toBe(true);
    expect(hasil.kataDisensor.sort()).toEqual(["cut loss", "jual saham ini", "kurangi porsi", "porsimu"]);
    // Fakta di kalimat/klausa yang sama TIDAK ikut hilang — hanya frasanya.
    expect(hasil.ringkasan).toBe("Alarm bolong sejak 2021-05-18. Sebaiknya [dihapus].");
    expect(hasil.emitenDibahas[0].sebab).toBe("ekuitas negatif; [dihapus] saja");
    // Alasan bersih → tanpa tanda; alasan bermasalah → teks UTUH + ditandai.
    expect(hasil.usulanBlok[0]).toEqual({
      kind: "insider_jual",
      threshold: "longgar",
      alasan: "orang dalam menjual (filing jual)",
      perluTinjau: false,
    });
    expect(hasil.usulanBlok[1]).toEqual({
      kind: "laporan_hilang",
      threshold: "ketat",
      alasan: "Ekuitas minus Rp1,1 triliun; kurangi porsimu di TELE.",
      perluTinjau: true,
    });
    expect(hasil.runId).toBeUndefined();
    expect(hasil.trace).toHaveLength(2);
  });

  it("batas yang diakui: kata Inggris telanjang 'buy' TIDAK ditangkap backstop", async () => {
    // Sengaja tidak didaftar: `transactionType` di data filing bernilai
    // "buy"/"sell", sehingga menyaringnya akan memakan kalimat fakta. Yang
    // menahan bentuk ini adalah instruksi sistem (lapis 1), dan README serta
    // /cara-kami-menghitung menyatakannya terang-terangan.
    const model = modelTiruan([
      langkahTool([{ toolName: "listMissed", input: {} }]),
      langkahTeks({
        ringkasan: "Alarm bolong. Buy the dip.",
        emitenDibahas: [],
        usulanBlok: [],
      }),
    ]);
    const hasil = await diagnosis({ rule, backtest, source: sumber, model, simpan: async () => undefined });
    expect(hasil.perluTinjau).toBe(false);
    expect(hasil.ringkasan).toBe("Alarm bolong. Buy the dip.");
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

// ---------------------------------------------------------------------------
// Jalur DUA FASE (gateway OpenAI-compatible, mis. Kagiro)
//
// Gateway tidak menegakkan skema secara native: SDK memperingatkan "JSON
// response schema is injected into the system message", dan perintah "jawab
// JSON saja" itu bertabrakan dengan loop tool sehingga DiagnosisOutputSchema
// gagal diparse. Tes di sini memastikan pemisahannya: fase 1 pakai tool TANPA
// responseFormat, fase 2 pakai responseFormat TANPA tool, trace tetap dari tool
// call sungguhan fase 1, dan biaya kedua fase dijumlahkan.
// ---------------------------------------------------------------------------

const PROSA_FASE_1 = [
  "Alarm hanya memakai blok laporan hilang, sedangkan TELE melapor lengkap sampai 2025-03-31.",
  "- TELE: suspensi 2024-12-27 tidak tercakup blok laporan hilang. Bukti: 2024-12-27, 2025-03-31.",
  "- Usulan 1: suspensi (longgar) - suspensi 2024-12-27 terjadi 5 bulan sebelum target.",
].join("\n");

const JAWABAN_RAPI = {
  ringkasan:
    "Alarm hanya memakai blok laporan hilang, sedangkan TELE masih melapor lengkap sampai kuartal terakhir sebelum kejadian.",
  emitenDibahas: [
    {
      symbol: "TELE",
      sebab: "Suspensi 2024-12-27 tidak tercakup blok laporan hilang.",
      buktiTanggal: ["2024-12-27", "2025-03-31"],
    },
  ],
  usulanBlok: [
    { kind: "suspensi", threshold: "longgar", alasan: "Suspensi 2024-12-27 terjadi 5 bulan sebelum target." },
  ],
};

/** [tool call] -> [prosa, menutup fase 1] -> [JSON fase 2, usage sengaja berbeda]. */
function modelDuaFase(prosa = PROSA_FASE_1, jawaban: unknown = JAWABAN_RAPI) {
  return modelTiruan([
    langkahTool([{ toolName: "listMissed", input: {} }, { toolName: "getSuspensions", input: { symbol: "TELE" } }]),
    langkahProsa(prosa),
    langkahTeks(jawaban, usageTiruan(7, 5, 3)),
  ]);
}

describe("diagnosis lewat gateway (dua fase)", () => {
  it("fase 1 = tool tanpa responseFormat, fase 2 = responseFormat tanpa tool", async () => {
    const model = modelDuaFase();
    const hasil = await diagnosis({ rule, backtest, source: sumber, model, duaFase: true, simpan: async () => undefined });

    expect(model.doGenerateCalls).toHaveLength(3);
    const [fase1a, fase1b, fase2] = model.doGenerateCalls;

    // Fase 1: tool lengkap terdaftar, TIDAK ada permintaan JSON terstruktur.
    for (const c of [fase1a, fase1b]) {
      expect(c.tools).toHaveLength(7);
      expect(c.responseFormat).toBeUndefined();
    }
    // Prompt fase 1 melarang model menulis JSON di tengah loop tool.
    expect(JSON.stringify(fase1a.prompt[1])).toContain("JANGAN menulis JSON");

    // Fase 2: skema diminta, tool DICABUT supaya tidak ada pilihan bercabang.
    expect(fase2.tools).toBeUndefined();
    expect(fase2.responseFormat?.type).toBe("json");
    expect(JSON.stringify(fase2.responseFormat)).toContain("usulanBlok");
    // Fase 2 menerima prosa fase 1 DAN hasil tool sungguhan (bukan ingatan model).
    const promptFase2 = JSON.stringify(fase2.prompt);
    expect(promptFase2).toContain("Penarikan data SUDAH SELESAI");
    expect(promptFase2).toContain("suspensi 2024-12-27 tidak tercakup");
    expect(promptFase2).toContain("1 suspensi: 2024-12-27"); // ringkasan hasil tool getSuspensions
    expect(promptFase2).toContain("getSuspensions");
    // Instruksi sistem (lapis 1) tetap terpasang di fase 2.
    expect(String(fase2.prompt[0].content)).toContain(DISCLAIMER);

    // Keluaran: dari fase 2; trace: dari tool call fase 1.
    expect(hasil.ringkasan).toBe(JAWABAN_RAPI.ringkasan);
    expect(hasil.emitenDibahas).toEqual(JAWABAN_RAPI.emitenDibahas);
    expect(hasil.usulanBlok).toEqual([
      { kind: "suspensi", threshold: "longgar", alasan: JAWABAN_RAPI.usulanBlok[0].alasan, perluTinjau: false },
    ]);
    expect(hasil.trace.map((t) => [t.step, t.tool])).toEqual([
      [0, "listMissed"],
      [0, "getSuspensions"],
    ]);
    expect(hasil.trace[1].ringkasanHasil).toBe("1 suspensi: 2024-12-27");
    expect(hasil.langkah).toBe(3); // 2 langkah fase 1 + 1 panggilan perangkum

    // Biaya = fase 1 (2 langkah x 100/20, cacheRead 40) + fase 2 (7/5, cacheRead 3).
    expect(hasil.usage).toEqual({
      inputTokens: 207,
      outputTokens: 45,
      totalTokens: 252,
      cacheReadTokens: 83,
      cacheWriteTokens: 0,
    });
  });

  it("LLM_BASE_URL terisi menyalakan jalur dua fase tanpa flag", async () => {
    vi.stubEnv("LLM_BASE_URL", "https://api.contoh.test/v1");
    const model = modelDuaFase();
    const hasil = await diagnosis({ rule, backtest, source: sumber, model, simpan: async () => undefined });
    expect(model.doGenerateCalls).toHaveLength(3);
    expect(model.doGenerateCalls[0].responseFormat).toBeUndefined();
    expect(model.doGenerateCalls[2].tools).toBeUndefined();
    expect(hasil.ringkasan).toBe(JAWABAN_RAPI.ringkasan);
  });

  it("tanpa LLM_BASE_URL tetap satu panggilan: responseFormat + tool sekaligus", async () => {
    const model = modelTiruan([langkahTool([{ toolName: "listMissed", input: {} }]), langkahTeks(JAWABAN_RAPI)]);
    await diagnosis({ rule, backtest, source: sumber, model, simpan: async () => undefined });
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(model.doGenerateCalls[0].tools).toHaveLength(7);
    expect(model.doGenerateCalls[0].responseFormat?.type).toBe("json");
  });

  it("backstop frasa tetap berlaku pada keluaran fase 2", async () => {
    const model = modelDuaFase(PROSA_FASE_1, {
      ringkasan: "Alarm bolong sejak 2021-05-18. Sebaiknya jual saham ini.",
      emitenDibahas: [{ symbol: "TELE", sebab: "ekuitas negatif; cut loss saja", buktiTanggal: ["2025-03-31"] }],
      usulanBlok: [{ kind: "suspensi", threshold: "longgar", alasan: "Suspensi 2024-12-27; kurangi porsimu di TELE." }],
    });
    const hasil = await diagnosis({ rule, backtest, source: sumber, model, duaFase: true, simpan: async () => undefined });
    expect(hasil.perluTinjau).toBe(true);
    expect(hasil.ringkasan).toBe("Alarm bolong sejak 2021-05-18. Sebaiknya [dihapus].");
    expect(hasil.emitenDibahas[0].sebab).toBe("ekuitas negatif; [dihapus] saja");
    expect(hasil.usulanBlok[0]).toEqual({
      kind: "suspensi",
      threshold: "longgar",
      alasan: "Suspensi 2024-12-27; kurangi porsimu di TELE.",
      perluTinjau: true,
    });
  });
});
