// POST /api/agent/diagnosis  { rule, backtest?, targetSymbol?, alarmId? }
// → ringkasan, emitenDibahas, usulanBlok, trace. Bila `backtest` tidak dikirim,
// runBacktest dijalankan dulu dari DB (DATABASE_URL) atau fixture.
import { NoObjectGeneratedError } from "ai";
import { z } from "zod";

import { AiKeyMissingError, diagnosis, hasAiKey, pilihSumber } from "@/lib/agent";
// Protokol jawaban bertahap ada di modul sendiri: berkas route Next.js tidak
// boleh mengekspor apa pun selain handler dan konfigurasi, dan klien butuh
// tipe yang sama untuk membacanya.
import { barisNdjson, TIPE_BERTAHAP, type BarisBertahap } from "@/lib/agent/bertahap";
import { jawabanTerlaluSering, kunciEmber, kunciPemanggil, pagarLaju } from "@/lib/api/pagar";
import { GROUPS, RuleError, RuleSchema, runBacktest, type BacktestResult } from "@/lib/engine";

// 300 detik = batas maksimum fungsi Vercel pada plan Hobby dengan fluid compute
// (docs "Configuring Maximum Duration", diperiksa 2026-09-12: Hobby default 300
// dan maksimum 300; Pro sampai 800). Diagnosis nyata lewat gateway terukur
// ~170 detik untuk 3-4 emiten, jadi 120 detik yang lama terlalu mepet: satu
// percobaan tanpa batas emiten terlewat berjalan 366 detik dan tetap gagal.
// Batas jumlah emiten (MAKS_TERLEWAT_DISODORKAN) yang menjaga agar tidak
// mendekati langit-langit ini; angka di sini hanya jaring terakhir.
export const maxDuration = 300;

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

/** Galat dari `diagnosis()` → status + kode + pesan. Dipakai kedua mode jawaban. */
function petaGalat(err: unknown): { status: number; kode: string; pesan: string; rincian?: unknown } {
  if (err instanceof AiKeyMissingError) return { status: 503, kode: "AI_TIDAK_TERSEDIA", pesan: err.message };
  if (err instanceof RuleError) return { status: 400, kode: "ATURAN_TIDAK_VALID", pesan: err.message, rincian: err.issues };
  if (NoObjectGeneratedError.isInstance(err)) {
    return {
      status: 502,
      kode: "DIAGNOSIS_TANPA_JAWABAN",
      pesan: "Model tidak menghasilkan jawaban terstruktur dalam batas langkah; coba lagi.",
    };
  }
  console.error("[api/agent/diagnosis]", err);
  return { status: 500, kode: "GALAT_INTERNAL", pesan: "Diagnosis gagal; coba lagi sesaat." };
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

  // Persiapan (sumber + backtest) SEBELUM memilih mode jawaban: galat di sini
  // tetap dijawab JSON dengan status HTTP-nya, persis seperti sebelum tiket 22,
  // jadi klien lama dan jalur 400/429/503 tidak berubah.
  const { rule, targetSymbol, alarmId, pakaiFixture } = parsed.data;
  let persiapan: { source: Awaited<ReturnType<typeof pilihSumber>>["source"]; keterangan: string; backtest: BacktestResult };
  try {
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
    persiapan = { source, keterangan, backtest };
  } catch (err) {
    const g = petaGalat(err);
    return galat(g.status, g.kode, g.pesan, g.rincian);
  }
  const { source, keterangan, backtest } = persiapan;
  const bungkus = (hasil: Awaited<ReturnType<typeof diagnosis>>) => ({
    sumber: keterangan,
    backtest: { hits: backtest.hits, total: backtest.total, falseAlarms: backtest.falseAlarms, controls: backtest.controls },
    ...hasil,
  });

  // Mode bertahap: hanya bila klien memintanya. Sesudah baris pertama terkirim
  // status HTTP sudah 200, jadi galat dari agent dikirim sebagai baris `galat`.
  if ((req.headers.get("accept") ?? "").includes(TIPE_BERTAHAP)) {
    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const kirim = (baris: BarisBertahap) => controller.enqueue(enc.encode(barisNdjson(baris)));
        try {
          const hasil = await diagnosis({
            rule,
            backtest,
            targetSymbol,
            source,
            alarmId,
            onLangkah: (langkah) => kirim({ jenis: "langkah", langkah }),
          });
          kirim({ jenis: "selesai", hasil: bungkus(hasil) });
        } catch (err) {
          const g = petaGalat(err);
          kirim({ jenis: "galat", status: g.status, error: { kode: g.kode, pesan: g.pesan, ...(g.rincian !== undefined ? { rincian: g.rincian } : {}) } });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        "content-type": `${TIPE_BERTAHAP}; charset=utf-8`,
        // Jangan disangga proksi: tanpa ini langkah bisa tertahan sampai akhir.
        "cache-control": "no-cache, no-transform",
        "x-accel-buffering": "no",
      },
    });
  }

  try {
    const hasil = await diagnosis({ rule, backtest, targetSymbol, source, alarmId });
    return Response.json(bungkus(hasil));
  } catch (err) {
    const g = petaGalat(err);
    return galat(g.status, g.kode, g.pesan, g.rincian);
  }
}
