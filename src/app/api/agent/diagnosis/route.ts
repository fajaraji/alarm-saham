// POST /api/agent/diagnosis  { rule, backtest?, targetSymbol?, alarmId? }
// → ringkasan, emitenDibahas, usulanBlok, trace. Bila `backtest` tidak dikirim,
// runBacktest dijalankan dulu dari DB (DATABASE_URL) atau fixture.
import { NoObjectGeneratedError } from "ai";
import { z } from "zod";

import { AiKeyMissingError, diagnosis, hasAiKey, pilihSumber } from "@/lib/agent";
import { jawabanTerlaluSering, kunciEmber, kunciPemanggil, pagarLaju } from "@/lib/api/pagar";
import { GROUPS, RuleError, RuleSchema, runBacktest, type BacktestResult } from "@/lib/engine";

export const maxDuration = 120;

// Diagnosis adalah panggilan LLM termahal di produk ini (loop tool-use sampai 8
// langkah). Publik, tetapi dibatasi lajunya agar URL deploy tidak bisa dipakai
// menguras saldo model pemilik.
const PAGAR = { maks: 10, jendelaMs: 60_000 };

const PerSymbolSchema = z.looseObject({
  symbol: z.string(),
  group: z.enum(GROUPS),
  targetEventDate: z.string().nullable(),
  scanFrom: z.string().nullable(),
  scanTo: z.string().nullable(),
  fired: z.boolean(),
  firstFireDate: z.string().nullable(),
  leadMonths: z.number().nullable(),
});

/** Bentuk minimal BacktestResult yang dibutuhkan agent; kunci lain diteruskan. */
const BacktestSchema = z.looseObject({
  rule: z.string(),
  scanStart: z.string(),
  today: z.string(),
  hits: z.number(),
  total: z.number(),
  falseAlarms: z.number(),
  controls: z.number(),
  perSymbol: z.array(PerSymbolSchema),
});

const BodySchema = z.object({
  rule: RuleSchema,
  backtest: BacktestSchema.optional(),
  targetSymbol: z.string().trim().toUpperCase().min(2).max(10).optional(),
  alarmId: z.uuid().optional(),
  /** Hanya untuk pengujian/demo: paksa fixture walau DATABASE_URL ada. */
  pakaiFixture: z.boolean().optional(),
});

function galat(status: number, kode: string, pesan: string, rincian?: unknown) {
  return Response.json({ error: { kode, pesan, ...(rincian !== undefined ? { rincian } : {}) } }, { status });
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return galat(400, "BODY_BUKAN_JSON", "Body harus JSON berisi { rule, backtest?, targetSymbol? }");
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return galat(
      400,
      "INPUT_TIDAK_VALID",
      "Input tidak valid",
      parsed.error.issues.map((i) => ({ path: i.path.map(String).join(".") || "(akar)", pesan: i.message })),
    );
  }
  if (!hasAiKey()) {
    return galat(503, "AI_TIDAK_TERSEDIA", new AiKeyMissingError().message);
  }
  // Ember sendiri: jatah route ini tidak boleh dihabiskan route lain, dan
  // sebaliknya (lihat kunciEmber di src/lib/api/pagar.ts).
  const pagar = pagarLaju(kunciEmber("agent-diagnosis", kunciPemanggil(req)), PAGAR);
  if (!pagar.lolos) return jawabanTerlaluSering(pagar.tungguDetik);

  try {
    const { rule, targetSymbol, alarmId, pakaiFixture } = parsed.data;
    const { source, universe, keterangan } = await pilihSumber(pakaiFixture);
    let backtest: BacktestResult;
    if (parsed.data.backtest) {
      backtest = parsed.data.backtest as unknown as BacktestResult;
    } else {
      if (universe.length === 0) {
        return galat(503, "UNIVERSE_KOSONG", `Universe kosong dari ${keterangan}; tidak ada yang bisa diuji.`);
      }
      backtest = await runBacktest(rule, universe, source);
    }
    const hasil = await diagnosis({ rule, backtest, targetSymbol, source, alarmId });
    return Response.json({ sumber: keterangan, backtest: { hits: backtest.hits, total: backtest.total, falseAlarms: backtest.falseAlarms, controls: backtest.controls }, ...hasil });
  } catch (err) {
    if (err instanceof AiKeyMissingError) return galat(503, "AI_TIDAK_TERSEDIA", err.message);
    if (err instanceof RuleError) return galat(400, "ATURAN_TIDAK_VALID", err.message, err.issues);
    if (NoObjectGeneratedError.isInstance(err)) {
      return galat(502, "DIAGNOSIS_TANPA_JAWABAN", "Model tidak menghasilkan jawaban terstruktur dalam batas langkah; coba lagi.");
    }
    console.error("[api/agent/diagnosis]", err);
    return galat(500, "GALAT_INTERNAL", "Diagnosis gagal; coba lagi sesaat.");
  }
}
