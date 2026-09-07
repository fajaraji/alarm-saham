// POST /api/backtest  { rule, today?, pakaiFixture? }
// → { sumber: 'db' | 'fixture', keterangan, hasil: BacktestResult }
//
// Server memilih sumber: DB (DATABASE_URL) bila ada, selain itu fixture
// universe-kecil.json. Nol panggilan API Sectors. Tidak butuh kunci AI.
import { z } from "zod";

import { pilihSumber } from "@/lib/agent/sumber";
import { RuleError, RuleSchema, runBacktest } from "@/lib/engine";

export const maxDuration = 60;

const BodySchema = z.object({
  rule: RuleSchema,
  /** Batas akhir pemindaian kontrol (default hari ini UTC); untuk tes deterministik. */
  today: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "today harus YYYY-MM-DD" })
    .optional(),
  /** Paksa fixture walau DATABASE_URL ada (demo/tes). */
  pakaiFixture: z.boolean().optional(),
});

export type SumberBacktest = "db" | "fixture";

function galat(status: number, kode: string, pesan: string, rincian?: unknown) {
  return Response.json({ error: { kode, pesan, ...(rincian !== undefined ? { rincian } : {}) } }, { status });
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return galat(400, "BODY_BUKAN_JSON", "Body harus JSON berisi { rule }");
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return galat(
      400,
      "ATURAN_TIDAK_VALID",
      "Aturan alarm tidak valid",
      parsed.error.issues.map((i) => ({ path: i.path.map(String).join(".") || "(akar)", pesan: i.message })),
    );
  }

  try {
    const { rule, today, pakaiFixture } = parsed.data;
    const { source, universe, keterangan } = await pilihSumber(pakaiFixture);
    if (universe.length === 0) {
      return galat(503, "UNIVERSE_KOSONG", `Universe kosong dari ${keterangan}; belum ada saham yang bisa diuji.`);
    }
    const hasil = await runBacktest(rule, universe, source, { today });
    const sumber: SumberBacktest = source.name === "db" ? "db" : "fixture";
    return Response.json({ sumber, keterangan, hasil });
  } catch (err) {
    if (err instanceof RuleError) return galat(400, "ATURAN_TIDAK_VALID", err.message, err.issues);
    console.error("[api/backtest]", err);
    return galat(500, "GALAT_INTERNAL", "Uji ke masa lalu gagal; coba lagi sesaat.");
  }
}
