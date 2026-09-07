// Agent diagnosis (inti tiket 08): "kenapa alarm bolong di emiten X?"
//
// Loop tool-use (AI SDK v7 `generateText` + `stopWhen: isStepCount(8)`) dengan
// tools yang membaca EventSource (suspensi, tanggal laporan, filing, aksi
// korporasi, financials), menjalankan mesin uji pada satu emiten/tanggal
// (`runAlarmOn` → `fires`), dan daftar emiten terlewat dari hasil backtest.
// Jawaban akhir terstruktur (Output.object); `trace` disusun dari
// `result.steps` (tool call sungguhan), bukan dari karangan model.
import { generateText, isStepCount, Output, tool, type LanguageModel, type StepResult, type ToolSet } from "ai";
import { z } from "zod";

import { getDb, hasDb, schema, type Db } from "../db";
import { fires, type FireResult } from "../engine/evaluate";
import type { EmitenEvents, EventSource } from "../engine/events";
import { BLOCK_KINDS, LABEL_BLOK, ringkasAturan, THRESHOLDS, type Rule } from "../engine/rules";
import type { BacktestResult, PerSymbolResult } from "../engine/score";
import { sensorObjek } from "./guard";
import { INSTRUKSI_DIAGNOSIS } from "./instructions";
import { instruksiSistem, opsiProvider, pilihModel, providerDari } from "./model";
import { ringkasUsage, type UsageRingkas } from "./usage";

// ---------------------------------------------------------------------------
// Skema keluaran model (tanpa trace — trace dibangun dari langkah SDK)
// ---------------------------------------------------------------------------

export const DiagnosisOutputSchema = z.object({
  ringkasan: z.string().describe("2–4 kalimat awam: kenapa alarm bolong dan apa usulannya"),
  emitenDibahas: z.array(
    z.object({
      symbol: z.string(),
      sebab: z.string().describe("Sebab alarm tidak berbunyi, berbasis data tool"),
      buktiTanggal: z.array(z.string()).describe("Tanggal YYYY-MM-DD dari data yang jadi bukti"),
    }),
  ),
  usulanBlok: z
    .array(
      z.object({
        kind: z.enum(BLOCK_KINDS),
        threshold: z.enum(THRESHOLDS),
        alasan: z.string(),
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

export interface DiagnosisResult extends DiagnosisOutput {
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

// ---------------------------------------------------------------------------
// Penyimpanan trace ke tabel `runs`
// ---------------------------------------------------------------------------

export interface RekamanRun {
  rule: Rule;
  backtest: BacktestResult;
  keluaran: DiagnosisOutput;
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

export async function diagnosis(input: DiagnosisInput): Promise<DiagnosisResult> {
  const model = pilihModel("penalaran", input.model);
  const provider = providerDari(model);
  const tools = buatTools(input);
  const hasil = await generateText({
    model,
    tools,
    instructions: instruksiSistem(INSTRUKSI_DIAGNOSIS, provider),
    prompt: susunPrompt(input),
    stopWhen: isStepCount(input.maxSteps ?? MAKS_LANGKAH_DEFAULT),
    output: Output.object({ schema: DiagnosisOutputSchema, name: "hasil_diagnosis" }),
    providerOptions: opsiProvider(provider, "high"),
  });

  const trace = susunTrace(hasil.steps);
  const usage = ringkasUsage(hasil.usage, hasil.providerMetadata);
  const mentah: DiagnosisOutput = {
    ...hasil.output,
    usulanBlok: hasil.output.usulanBlok.slice(0, MAKS_USULAN),
  };
  // Sensor hanya teks karangan model; `kind`/`threshold`/`symbol`/tanggal berasal dari data.
  const sensor = sensorObjek(mentah, ["kind", "threshold", "symbol", "buktiTanggal"]);

  const simpan = input.simpan ?? ((rek: RekamanRun) => simpanRunKeDb(rek));
  const runId = await simpan({
    rule: input.rule,
    backtest: input.backtest,
    keluaran: sensor.hasil,
    trace,
    usage,
    alarmId: input.alarmId,
  });

  return {
    ...sensor.hasil,
    trace,
    langkah: hasil.steps.length,
    perluTinjau: sensor.perluTinjau,
    kataDisensor: sensor.kataDisensor,
    usage,
    ...(runId ? { runId } : {}),
  };
}
