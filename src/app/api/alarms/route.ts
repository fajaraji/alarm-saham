// POST /api/alarms  { owner_token, name, rules, last_score? }
// → 201 { id, di: 'db', createdAt } bila DATABASE_URL ada;
//   503 DB_TIDAK_TERSEDIA bila tidak (klien menyimpan di localStorage).
//
// Tanpa login (PLAN §2): pemilik dikenali dari token acak yang dibuat browser.
import { z } from "zod";

import { getDb, hasDb, schema } from "@/lib/db";
import { RuleSchema } from "@/lib/engine";

export const maxDuration = 30;

const BodySchema = z.object({
  owner_token: z
    .string({ error: "owner_token harus berupa teks" })
    .trim()
    .min(16, { error: "owner_token terlalu pendek" })
    .max(128, { error: "owner_token terlalu panjang" }),
  name: z.string({ error: "name harus berupa teks" }).trim().min(1, { error: "name tidak boleh kosong" }).max(120),
  rules: z.array(RuleSchema, { error: "rules harus berupa daftar aturan" }).min(1, { error: "minimal 1 aturan" }).max(10),
  last_score: z.record(z.string(), z.unknown()).nullable().optional(),
});

function galat(status: number, kode: string, pesan: string, rincian?: unknown) {
  return Response.json({ error: { kode, pesan, ...(rincian !== undefined ? { rincian } : {}) } }, { status });
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return galat(400, "BODY_BUKAN_JSON", "Body harus JSON berisi { owner_token, name, rules }");
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
  if (!hasDb()) {
    return galat(503, "DB_TIDAK_TERSEDIA", "Server belum punya database; alarm disimpan di browser ini saja.");
  }
  try {
    const { owner_token, name, rules, last_score } = parsed.data;
    const [baris] = await getDb()
      .insert(schema.alarms)
      .values({ ownerToken: owner_token, name, rules, lastScore: last_score ?? null })
      .returning({ id: schema.alarms.id, createdAt: schema.alarms.createdAt });
    return Response.json({ id: baris.id, di: "db", createdAt: baris.createdAt.toISOString() }, { status: 201 });
  } catch (err) {
    console.error("[api/alarms]", err);
    return galat(500, "GALAT_INTERNAL", "Gagal menyimpan alarm; coba lagi sesaat.");
  }
}
