// Agent diagnosis (inti tiket 08): "kenapa alarm bolong di emiten X?"
//
// Loop tool-use (AI SDK v7 `generateText` + `stopWhen: isStepCount(8)`) dengan
// tools yang membaca EventSource (suspensi, tanggal laporan, filing, aksi
// korporasi, financials), menjalankan mesin uji pada satu emiten/tanggal
// (`runAlarmOn` → `fires`), dan daftar emiten terlewat dari hasil backtest.
// Jawaban akhir terstruktur (Output.object); `trace` disusun dari
// `result.steps` (tool call sungguhan), bukan dari karangan model.
//
// Dua jalur panggilan model — lihat `jalankanModel`: satu fase untuk provider
// langsung, DUA fase saat lewat gateway OpenAI-compatible (LLM_BASE_URL), yang
// tidak bisa menegakkan skema dan loop tool sekaligus.
import { generateText, isStepCount, Output, tool, type LanguageModel, type StepResult, type ToolSet } from "ai";
import { z } from "zod";

import { getDb, hasDb, schema, type Db } from "../db";
import { fires, type FireResult } from "../engine/evaluate";
import type { EmitenEvents, EventSource } from "../engine/events";
import { BLOCK_KINDS, LABEL_BLOK, ringkasAturan, THRESHOLDS, type BlockKind, type Rule, type Threshold } from "../engine/rules";
import type { BacktestResult, PerSymbolResult } from "../engine/score";
import { periksaFrasa, sensorObjek } from "./guard";
import { INSTRUKSI_DIAGNOSIS } from "./instructions";
import { instruksiSistem, opsiProvider, pakaiGateway, pilihModel, providerDari, type Provider } from "./model";
import { gabungUsage, ringkasUsage, type UsageRingkas } from "./usage";

// ---------------------------------------------------------------------------
// Skema keluaran model (tanpa trace — trace dibangun dari langkah SDK)
// ---------------------------------------------------------------------------

/**
 * Skema keluaran = KONTROL STRUKTURAL aturan lomba (b), lapis kedua sesudah
 * instruksi sistem (lihat instructions.ts). `kind` dan `threshold` enum,
 * `buktiTanggal` tanggal, dan setiap medan prosa bebas dipersempit lewat
 * `describe()` — deskripsi ini ikut dikirim ke provider, jadi ia bagian dari
 * kontrolnya, bukan komentar. Batas panjangnya sengaja TIDAK ditegakkan
 * `z.string().max()`: kegagalan validasi memunculkan NoObjectGeneratedError dan
 * menghapus seluruh diagnosis, harga yang terlalu mahal untuk prosa yang
 * kepanjangan.
 */
export const DiagnosisOutputSchema = z.object({
  ringkasan: z
    .string()
    .describe(
      "2–4 kalimat awam (±600 karakter): kenapa alarm bolong dan apa usulannya. Subjek setiap kalimat WAJIB data atau aturan alarm — jangan menyinggung posisi, porsi, lot, dana, atau waktu transaksi pengguna.",
    ),
  emitenDibahas: z.array(
    z.object({
      symbol: z.string(),
      sebab: z
        .string()
        .describe(
          "1–2 kalimat sebab alarm tidak berbunyi, berbasis data tool dan menyebut tanggalnya. Bukan penilaian tentang emitennya.",
        ),
      buktiTanggal: z.array(z.string()).describe("Tanggal YYYY-MM-DD dari data yang jadi bukti"),
    }),
  ),
  usulanBlok: z
    .array(
      z.object({
        kind: z.enum(BLOCK_KINDS),
        threshold: z.enum(THRESHOLDS),
        alasan: z
          .string()
          .describe(
            "Satu kalimat (±300 karakter) kenapa blok ini menolong menurut data — mis. tanggal bukti atau perubahan jumlah temuan. Tentang blok dan datanya, bukan tentang apa yang sebaiknya pengguna lakukan atas sahamnya.",
          ),
      }),
    )
    .describe("Maksimal 2 usulan blok tambahan/pengetatan"),
});
export type DiagnosisOutput = z.infer<typeof DiagnosisOutputSchema>;

export interface TraceStep {
  /** Nomor langkah (0-based) dari `result.steps`. */
  step: number;
  tool: string;
  input: unknown;
  ringkasanHasil: string;
}

/**
 * Usulan blok setelah pemeriksaan backstop. `alasan` TIDAK pernah digunting:
 * usulan blok tanpa alasan menghapus justru nilai jual produk (penyerang
 * putaran 4 membuktikan kedua alasan bisa hilang sekaligus). Bila penjaga frasa
 * menyala di sana, teksnya dibiarkan apa adanya dan `perluTinjau` dinyalakan
 * supaya UI memasang tanda peringatan pada usulan itu.
 */
export interface UsulanBlokDiperiksa {
  kind: BlockKind;
  threshold: Threshold;
  alasan: string;
  /** true bila `alasan` memuat frasa backstop; teksnya tetap utuh. */
  perluTinjau: boolean;
}

export interface DiagnosisKeluaran extends Omit<DiagnosisOutput, "usulanBlok"> {
  usulanBlok: UsulanBlokDiperiksa[];
}

export interface DiagnosisResult extends DiagnosisKeluaran {
  trace: TraceStep[];
  langkah: number;
  perluTinjau: boolean;
  kataDisensor: string[];
  usage: UsageRingkas;
  /** ID baris `runs` bila tersimpan ke DB. */
  runId?: string;
}

export interface DiagnosisInput {
  rule: Rule;
  backtest: BacktestResult;
  /** Emiten yang diminta khusus dibahas (opsional). */
  targetSymbol?: string;
  source: EventSource;
  /** Model suntikan (tes memakai MockLanguageModelV4). Default: model peran 'penalaran' dari provider terpilih. */
  model?: LanguageModel;
  /** Batas langkah loop tool-use (default 8). */
  maxSteps?: number;
  /**
   * Paksa jalur DUA FASE (lihat `jalankanModel`). Default: `pakaiGateway()` —
   * menyala sendiri saat LLM_BASE_URL diisi. Diset eksplisit oleh tes.
   */
  duaFase?: boolean;
  /** Alarm pemilik trace (opsional) untuk penyimpanan ke tabel `runs`. */
  alarmId?: string;
  /** Penyimpan trace; default menulis ke DB bila `hasDb()`, dilewati bila tidak. */
  simpan?: PenyimpanRun;
}

export const MAKS_LANGKAH_DEFAULT = 8;
export const MAKS_USULAN = 2;

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

const symbolSchema = z.string().trim().toUpperCase().describe("Kode emiten, mis. TELE");
const tanggalSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("Tanggal evaluasi t (YYYY-MM-DD), biasanya akhir bulan");

function emitenTerlewat(backtest: BacktestResult): PerSymbolResult[] {
  return backtest.perSymbol.filter((r) => r.group !== "control" && !r.fired);
}

function buatTools(input: DiagnosisInput) {
  const { source, rule, backtest } = input;
  const cache = new Map<string, Promise<EmitenEvents>>();
  const events = (symbol: string) => {
    const s = symbol.trim().toUpperCase();
    if (!cache.has(s)) cache.set(s, source.events(s));
    return cache.get(s)!;
  };

  return {
    listMissed: tool({
      description:
        "Daftar emiten kena (delisting/watchlist) yang alarmnya TERLEWAT pada backtest, beserta tanggal kejadian target dan rentang pindai. Panggil ini dulu.",
      inputSchema: z.object({}),
      execute: async () => ({
        aturan: ringkasAturan(rule),
        terlewat: emitenTerlewat(backtest).map((r) => ({
          symbol: r.symbol,
          group: r.group,
          targetEventDate: r.targetEventDate,
          scanFrom: r.scanFrom,
          scanTo: r.scanTo,
        })),
        tertangkap: backtest.perSymbol
          .filter((r) => r.group !== "control" && r.fired)
          .map((r) => ({ symbol: r.symbol, firstFireDate: r.firstFireDate, leadMonths: r.leadMonths })),
        alarmPalsu: backtest.perSymbol
          .filter((r) => r.group === "control" && r.fired)
          .map((r) => ({ symbol: r.symbol, firstFireDate: r.firstFireDate })),
      }),
    }),
    getSuspensions: tool({
      description: "Semua kejadian suspensi satu emiten (tanggal + alasan dari bursa).",
      inputSchema: z.object({ symbol: symbolSchema }),
      execute: async ({ symbol }) => {
        const e = await events(symbol);
        return { symbol: e.symbol, jumlah: e.suspensions.length, suspensions: e.suspensions };
      },
    }),
    getReportDates: tool({
      description:
        "Daftar kuartal laporan keuangan yang TERSEDIA untuk satu emiten (akhir periode, label kuartal, tahun fiskal). Kuartal yang tidak ada di daftar = belum/tidak dilaporkan.",
      inputSchema: z.object({ symbol: symbolSchema }),
      execute: async ({ symbol }) => {
        const e = await events(symbol);
        return {
          symbol: e.symbol,
          jumlah: e.quarters.length,
          kuartalPertama: e.quarters[0]?.periodEnd ?? null,
          kuartalTerakhir: e.quarters[e.quarters.length - 1]?.periodEnd ?? null,
          quarters: e.quarters,
        };
      },
    }),
    getFilings: tool({
      description:
        "Filing transaksi pemegang saham (orang dalam/institusi) satu emiten: tanggal, tipe holder, tipe transaksi, persentase sebelum/sesudah. Data hanya tersedia mulai 2024.",
      inputSchema: z.object({ symbol: symbolSchema }),
      execute: async ({ symbol }) => {
        const e = await events(symbol);
        return { symbol: e.symbol, jumlah: e.filings.length, filings: e.filings };
      },
    }),
    getCorporateActions: tool({
      description: "Aksi korporasi dilutif (rights issue) satu emiten: ex-date dan rasio saham baru/lama.",
      inputSchema: z.object({ symbol: symbolSchema }),
      execute: async ({ symbol }) => {
        const e = await events(symbol);
        return { symbol: e.symbol, jumlah: e.rightIssues.length, rightIssues: e.rightIssues };
      },
    }),
    getFinancials: tool({
      description: "Ekuitas total per kuartal satu emiten (negatif = utang lebih besar dari harta).",
      inputSchema: z.object({ symbol: symbolSchema }),
      execute: async ({ symbol }) => {
        const e = await events(symbol);
        return { symbol: e.symbol, jumlah: e.financials.length, financials: e.financials };
      },
    }),
    runAlarmOn: tool({
      description:
        "Jalankan mesin uji: apakah aturan berbunyi untuk emiten pada tanggal t (hanya data bertanggal <= t). Opsional `blocks` untuk mencoba blok lain/pengetatan tanpa mengubah aturan asli.",
      inputSchema: z.object({
        symbol: symbolSchema,
        t: tanggalSchema,
        blocks: z
          .array(z.object({ kind: z.enum(BLOCK_KINDS), threshold: z.enum(THRESHOLDS) }))
          .nullable()
          .describe("Blok percobaan (null = pakai aturan asli)"),
        combine: z.enum(["any", "all"]).nullable().describe("Cara gabung percobaan (null = aturan asli)"),
      }),
      execute: async ({ symbol, t, blocks, combine }) => {
        const e = await events(symbol);
        const percobaan: Rule =
          blocks && blocks.length > 0
            ? { name: "percobaan", combine: combine ?? rule.combine, blocks }
            : rule;
        const hasil: FireResult = fires(percobaan, e, t);
        return { symbol: e.symbol, t, aturan: ringkasAturan(percobaan), fired: hasil.fired, reasons: hasil.reasons };
      },
    }),
  } satisfies ToolSet;
}

type DiagnosisTools = ReturnType<typeof buatTools>;

// ---------------------------------------------------------------------------
// Trace dari langkah SDK
// ---------------------------------------------------------------------------

function potong(s: string, n = 240): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

function ringkasHasilTool(tool: string, output: unknown): string {
  const o = output as Record<string, unknown> | undefined;
  if (!o || typeof o !== "object") return potong(JSON.stringify(output ?? null));
  switch (tool) {
    case "listMissed": {
      const t = (o.terlewat as { symbol: string }[]) ?? [];
      const k = (o.tertangkap as { symbol: string }[]) ?? [];
      return `terlewat: ${t.map((x) => x.symbol).join(", ") || "-"}; tertangkap: ${k.map((x) => x.symbol).join(", ") || "-"}`;
    }
    case "getSuspensions": {
      const s = (o.suspensions as { date: string }[]) ?? [];
      return `${s.length} suspensi${s.length ? `: ${s.map((x) => x.date).join(", ")}` : ""}`;
    }
    case "getReportDates":
      return `${o.jumlah} kuartal tersedia (${o.kuartalPertama ?? "-"} .. ${o.kuartalTerakhir ?? "-"})`;
    case "getFilings": {
      const f = (o.filings as { transactionType: string | null }[]) ?? [];
      const jual = f.filter((x) => x.transactionType === "sell").length;
      return `${f.length} filing (${jual} tipe jual)`;
    }
    case "getCorporateActions": {
      const r = (o.rightIssues as { exDate: string }[]) ?? [];
      return `${r.length} rights issue${r.length ? `: ${r.map((x) => x.exDate).join(", ")}` : ""}`;
    }
    case "getFinancials": {
      const f = (o.financials as { date: string; totalEquity: number | null }[]) ?? [];
      const akhir = f[f.length - 1];
      return `${f.length} kuartal keuangan${akhir ? `; terakhir ${akhir.date} ekuitas ${akhir.totalEquity ?? "null"}` : ""}`;
    }
    case "runAlarmOn": {
      const reasons = (o.reasons as { kind: string; detail: string }[]) ?? [];
      return `${o.symbol} @ ${o.t} [${o.aturan}] → ${o.fired ? "BERBUNYI" : "diam"}${
        reasons.length ? `; ${reasons.map((r) => `${r.kind}: ${r.detail}`).join("; ")}` : ""
      }`;
    }
    default:
      return potong(JSON.stringify(output));
  }
}

/** Susun trace dari langkah-langkah SDK: setiap tool call + hasilnya. */
export function susunTrace(steps: ReadonlyArray<StepResult<DiagnosisTools>>): TraceStep[] {
  const trace: TraceStep[] = [];
  steps.forEach((s, i) => {
    for (const tc of s.toolCalls) {
      const hasil = s.toolResults.find((r) => r.toolCallId === tc.toolCallId);
      const galat = s.content.find(
        (p) => p.type === "tool-error" && p.toolCallId === tc.toolCallId,
      ) as { error?: unknown } | undefined;
      trace.push({
        step: i,
        tool: tc.toolName,
        input: tc.input,
        ringkasanHasil: hasil
          ? ringkasHasilTool(tc.toolName, hasil.output)
          : galat
            ? `GALAT: ${potong(String((galat.error as Error)?.message ?? galat.error))}`
            : "(tanpa hasil)",
      });
    }
  });
  return trace;
}

// ---------------------------------------------------------------------------
// Prompt pengguna (konten dinamis — di luar bagian yang di-cache)
// ---------------------------------------------------------------------------

function susunPrompt(input: DiagnosisInput): string {
  const { rule, backtest, targetSymbol } = input;
  const terlewat = emitenTerlewat(backtest);
  const baris = [
    `Aturan alarm: "${rule.name}" = ${ringkasAturan(rule)}.`,
    `Hasil backtest (${backtest.scanStart} .. ${backtest.today}, sumber ${input.source.name}): tertangkap ${backtest.hits}/${backtest.total} emiten kena; alarm palsu ${backtest.falseAlarms}/${backtest.controls} kontrol.`,
    terlewat.length
      ? `Emiten kena yang TERLEWAT: ${terlewat
          .map((r) => `${r.symbol} (${r.group}, target ${r.targetEventDate}, pindai ${r.scanFrom ?? "-"}..${r.scanTo ?? "-"})`)
          .join("; ")}.`
      : "Tidak ada emiten kena yang terlewat.",
  ];
  if (targetSymbol) {
    baris.push(`Fokuskan pembahasan pada emiten ${targetSymbol.trim().toUpperCase()}.`);
  }
  baris.push(
    `Blok yang tersedia: ${BLOCK_KINDS.map((k) => `${k} (${LABEL_BLOK[k]})`).join(", ")}.`,
    "Jelaskan kenapa alarm bolong pada emiten terlewat (utamakan kasus nyata) dan usulkan maksimal 2 blok tambahan/pengetatan, semua berbasis data tool.",
  );
  return baris.join("\n");
}

/**
 * Tambahan prompt FASE 1 pada jalur dua fase. Di fase ini `output` tidak
 * dikirim, jadi model tidak tahu bentuk yang diharapkan fase 2 — bagian ini
 * yang memberitahunya, sekaligus melarangnya menulis JSON (JSON separuh jadi di
 * tengah loop tool adalah persis yang membuat parse gagal di mode kompatibilitas).
 */
const TAMBAHAN_JELAJAH = `Di panggilan ini JANGAN menulis JSON. Pakai tool sebanyak yang perlu, lalu tutup dengan prosa singkat berpoin:
- Ringkasan 2-4 kalimat awam: kenapa alarm bolong.
- Tiap emiten yang dibahas: kode emiten, sebab 1-2 kalimat, dan tanggal buktinya (YYYY-MM-DD).
- Maksimal 2 usulan blok: nama blok + ambang (pakai nama persis dari daftar blok di atas) + satu kalimat alasan.`;

/**
 * Prompt FASE 2: merapikan temuan fase 1 menjadi objek keluaran. Langkah data
 * sungguhan ikut dikirim supaya tanggal dan angka tidak perlu diingat-ingat
 * model (dan tidak ada alasan mengarang) — teks fase 1 saja pernah membuat
 * model mengulang tanggal dengan keliru saat prosanya panjang.
 */
function promptRangkum(teks: string, trace: TraceStep[]): string {
  const langkahData = trace.length
    ? trace.map((t, i) => `${i + 1}. ${t.tool}(${JSON.stringify(t.input)}) -> ${t.ringkasanHasil}`).join("\n")
    : "(tidak ada tool yang dipanggil)";
  return [
    "Penarikan data SUDAH SELESAI. Tugasmu di panggilan ini hanya memindahkan temuan di bawah ke objek keluaran sesuai skema: jangan memanggil tool, jangan menambah fakta, jangan mengubah angka atau tanggal. Batas pokok bahasan (butir 1 dan 1b) tetap berlaku.",
    "",
    "Langkah data yang sudah dijalankan (hasil sungguhan):",
    langkahData,
    "",
    "Temuan yang kamu tulis sendiri:",
    teks.trim() || "(kosong - susun keluaran dari langkah data di atas saja)",
    "",
    `Nama blok yang sah: ${BLOCK_KINDS.join(", ")}. Ambang yang sah: ${THRESHOLDS.join(", ")}. Maksimal ${MAKS_USULAN} usulan blok; kosongkan bila data tidak cukup.`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Penyimpanan trace ke tabel `runs`
// ---------------------------------------------------------------------------

export interface RekamanRun {
  rule: Rule;
  backtest: BacktestResult;
  keluaran: DiagnosisKeluaran;
  trace: TraceStep[];
  usage: UsageRingkas;
  alarmId?: string;
}
export type PenyimpanRun = (rekaman: RekamanRun) => Promise<string | undefined>;

/**
 * Simpan ke `runs`. Tabel `runs` wajib merujuk `alarms`; tanpa `alarmId`
 * dibuat baris alarm sementara berpemilik "agent-diagnosis". Tidak pernah
 * melempar — kegagalan hanya dicatat sebagai peringatan.
 */
export async function simpanRunKeDb(rekaman: RekamanRun, db?: Db): Promise<string | undefined> {
  if (!db && !hasDb()) return undefined;
  try {
    const d = db ?? getDb();
    let alarmId = rekaman.alarmId;
    if (!alarmId) {
      const [a] = await d
        .insert(schema.alarms)
        .values({ ownerToken: "agent-diagnosis", name: rekaman.rule.name, rules: [rekaman.rule] })
        .returning({ id: schema.alarms.id });
      alarmId = a.id;
    }
    const [r] = await d
      .insert(schema.runs)
      .values({
        alarmId,
        score: {
          hits: rekaman.backtest.hits,
          total: rekaman.backtest.total,
          falseAlarms: rekaman.backtest.falseAlarms,
          controls: rekaman.backtest.controls,
          leadMonthsAvg: rekaman.backtest.leadMonthsAvg,
        },
        details: {
          jenis: "diagnosis",
          keluaran: rekaman.keluaran,
          trace: rekaman.trace,
          usage: rekaman.usage,
        },
      })
      .returning({ id: schema.runs.id });
    return r.id;
  } catch (err) {
    console.warn(`[agent] trace diagnosis tidak tersimpan ke DB: ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Inti
// ---------------------------------------------------------------------------

interface HasilModel {
  keluaran: DiagnosisOutput;
  trace: TraceStep[];
  /** Jumlah panggilan model (loop tool + perangkum pada jalur dua fase). */
  langkah: number;
  usage: UsageRingkas;
}

/**
 * Jalankan model, satu fase atau dua.
 *
 * SATU FASE (DeepSeek/Anthropic langsung): satu `generateText` dengan `tools`,
 * `stopWhen`, dan `output` sekaligus. Provider menegakkan skema secara native
 * (response_format / tool khusus), jadi loop tool dan keluaran terstruktur
 * hidup berdampingan.
 *
 * DUA FASE (gateway OpenAI-compatible, mis. Kagiro): gateway TIDAK menegakkan
 * skema secara native — ia menyuntikkan skema JSON ke pesan sistem ("JSON
 * response schema is injected into the system message", peringatan SDK) dan
 * menyuruh model menjawab JSON saja. Perintah itu bertabrakan dengan loop
 * tool: di setiap langkah model dipaksa memilih antara memanggil tool dan
 * menulis JSON, dan hasilnya `AI_NoObjectGeneratedError: could not parse the
 * response` pada DiagnosisOutputSchema (skema sederhana lolos — jadi yang
 * bermasalah kombinasinya, bukan gatewaynya). Karena itu tugasnya dipisah:
 * fase 1 memakai tool tanpa `output` (bebas menulis prosa), fase 2 satu
 * panggilan tanpa tool dengan `output` untuk merapikannya menjadi objek.
 * `trace` TETAP dibangun dari langkah fase 1 — bukti tool call sungguhan tidak
 * berubah, dan fase 2 tidak bisa menambah langkah palsu karena tanpa tool.
 */
async function jalankanModel(
  input: DiagnosisInput,
  model: LanguageModel,
  provider: Provider,
  tools: DiagnosisTools,
): Promise<HasilModel> {
  const instructions = instruksiSistem(INSTRUKSI_DIAGNOSIS, provider);
  const providerOptions = opsiProvider(provider, "high");
  const stopWhen = isStepCount(input.maxSteps ?? MAKS_LANGKAH_DEFAULT);
  const output = Output.object({ schema: DiagnosisOutputSchema, name: "hasil_diagnosis" });

  if (!(input.duaFase ?? pakaiGateway())) {
    const hasil = await generateText({ model, tools, instructions, prompt: susunPrompt(input), stopWhen, output, providerOptions });
    return {
      keluaran: hasil.output,
      trace: susunTrace(hasil.steps),
      langkah: hasil.steps.length,
      usage: ringkasUsage(hasil.usage, hasil.providerMetadata),
    };
  }

  const jelajah = await generateText({
    model,
    tools,
    instructions,
    prompt: `${susunPrompt(input)}\n\n${TAMBAHAN_JELAJAH}`,
    stopWhen,
    providerOptions,
  });
  const trace = susunTrace(jelajah.steps);
  const rangkum = await generateText({
    model,
    instructions,
    prompt: promptRangkum(jelajah.text, trace),
    output,
    providerOptions,
  });
  return {
    keluaran: rangkum.output,
    trace,
    langkah: jelajah.steps.length + rangkum.steps.length,
    usage: gabungUsage(
      ringkasUsage(jelajah.usage, jelajah.providerMetadata),
      ringkasUsage(rangkum.usage, rangkum.providerMetadata),
    ),
  };
}

export async function diagnosis(input: DiagnosisInput): Promise<DiagnosisResult> {
  const model = pilihModel("penalaran", input.model);
  const provider = providerDari(model);
  const hasil = await jalankanModel(input, model, provider, buatTools(input));

  const { trace, usage } = hasil;
  const mentah: DiagnosisOutput = {
    ...hasil.keluaran,
    usulanBlok: hasil.keluaran.usulanBlok.slice(0, MAKS_USULAN),
  };
  // Backstop frasa. `kind`/`threshold`/`symbol`/tanggal dilewati karena berasal
  // dari data (enum & tanggal), bukan karangan model — itu kontrol strukturalnya.
  // `alasan` hanya DITANDAI: menggunting alasan usulan blok menghapus keluaran
  // inti fitur, jadi teksnya dibiarkan utuh dan usulan itu diberi bendera.
  const sensor = sensorObjek(mentah, {
    lewati: ["kind", "threshold", "symbol", "buktiTanggal"],
    tandaiSaja: ["alasan"],
  });
  const keluaran: DiagnosisKeluaran = {
    ...sensor.hasil,
    usulanBlok: sensor.hasil.usulanBlok.map((u) => ({ ...u, perluTinjau: periksaFrasa(u.alasan).length > 0 })),
  };

  const simpan = input.simpan ?? ((rek: RekamanRun) => simpanRunKeDb(rek));
  const runId = await simpan({
    rule: input.rule,
    backtest: input.backtest,
    keluaran,
    trace,
    usage,
    alarmId: input.alarmId,
  });

  return {
    ...keluaran,
    trace,
    langkah: hasil.langkah,
    perluTinjau: sensor.perluTinjau,
    kataDisensor: sensor.kataDisensor,
    usage,
    ...(runId ? { runId } : {}),
  };
}
