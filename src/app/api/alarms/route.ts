// POST /api/alarms  { owner_token, name, rules, last_score? }
// → 201 { id, di: 'db', createdAt } bila server punya database (Neon, atau PGlite
//   lokal; sama dengan /api/portofolio lewat dbJaga);
//   503 DB_TIDAK_TERSEDIA bila tidak (klien menyimpan di localStorage).
// GET  /api/alarms  (header x-owner-token) → { alarms: [{id, name, rules, createdAt}] }
//   daftar alarm milik pemilik untuk layar "Pasang" (tiket 11); 503 tanpa DB.
// DELETE /api/alarms?id=<uuid>  (header x-owner-token) → { dihapus: id }
//   hanya alarm milik token itu (tiket 33); alarm pemilik lain → 404, bukan 403,
//   supaya id alarm orang lain tidak bisa ditebak ada atau tidaknya.
//
// Tanpa login (PLAN §2): pemilik dikenali dari token acak yang dibuat browser.
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { schema } from "@/lib/db";
import { RuleSchema } from "@/lib/engine";
import { dbJaga } from "@/lib/jaga/penyedia";
import { tokenDariHeader } from "@/lib/jaga/portofolio";

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

export async function GET(req: Request): Promise<Response> {
  const token = tokenDariHeader(req);
  if (!token) return galat(401, "TOKEN_TIDAK_ADA", "Header x-owner-token wajib (16–128 karakter).");
  try {
    const db = await dbJaga();
    if (!db) {
      return galat(503, "DB_TIDAK_TERSEDIA", "Server belum punya database; alarm dibaca dari browser ini saja.");
    }
    const rows = await db
      .select({
        id: schema.alarms.id,
        name: schema.alarms.name,
        rules: schema.alarms.rules,
        createdAt: schema.alarms.createdAt,
      })
      .from(schema.alarms)
      .where(eq(schema.alarms.ownerToken, token))
      .orderBy(desc(schema.alarms.createdAt));
    return Response.json({
      alarms: rows.map((r) => ({ id: r.id, name: r.name, rules: r.rules, createdAt: r.createdAt.toISOString() })),
    });
  } catch (err) {
    console.error("[api/alarms GET]", err);
    return galat(500, "GALAT_INTERNAL", "Gagal memuat daftar alarm; coba lagi sesaat.");
  }
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
  try {
    const db = await dbJaga();
    if (!db) {
      return galat(503, "DB_TIDAK_TERSEDIA", "Server belum punya database; alarm disimpan di browser ini saja.");
    }
    const { owner_token, name, rules, last_score } = parsed.data;
    const [baris] = await db
      .insert(schema.alarms)
      .values({ ownerToken: owner_token, name, rules, lastScore: last_score ?? null })
      .returning({ id: schema.alarms.id, createdAt: schema.alarms.createdAt });
    return Response.json({ id: baris.id, di: "db", createdAt: baris.createdAt.toISOString() }, { status: 201 });
  } catch (err) {
    console.error("[api/alarms]", err);
    return galat(500, "GALAT_INTERNAL", "Gagal menyimpan alarm; coba lagi sesaat.");
  }
}

const IdSchema = z.uuid({ error: "id alarm harus UUID" });

export async function DELETE(req: Request): Promise<Response> {
  const token = tokenDariHeader(req);
  if (!token) return galat(401, "TOKEN_TIDAK_ADA", "Header x-owner-token wajib (16–128 karakter).");
  const id = IdSchema.safeParse(new URL(req.url).searchParams.get("id") ?? "");
  if (!id.success) return galat(400, "ID_TIDAK_SAH", "Parameter id harus UUID alarm.");
  try {
    const db = await dbJaga();
    if (!db) {
      return galat(503, "DB_TIDAK_TERSEDIA", "Server belum punya database; alarm hanya ada di browser ini.");
    }
    // Pemilik ikut di WHERE: token lain tidak bisa menghapus alarm yang bukan miliknya.
    const dihapus = await db
      .delete(schema.alarms)
      .where(and(eq(schema.alarms.id, id.data), eq(schema.alarms.ownerToken, token)))
      .returning({ id: schema.alarms.id });
    if (dihapus.length === 0) return galat(404, "ALARM_TIDAK_ADA", "Alarm itu tidak ada untuk tautan ini.");
    return Response.json({ dihapus: dihapus[0].id });
  } catch (err) {
    console.error("[api/alarms DELETE]", err);
    return galat(500, "GALAT_INTERNAL", "Gagal menghapus alarm; coba lagi sesaat.");
  }
}
