// /api/portofolio — portofolio per tautan rahasia (header x-owner-token).
//   GET    → { portofolio: {id, symbols, alarmIds, createdAt} | null }
//   POST   { symbols, alarmIds? } → upsert; 400 SAHAM_GANDA bila ada kode ganda
//   DELETE → { dihapus }
// 501 DB_TIDAK_TERSEDIA bila server hanya punya fixture (tanpa Neon/PGlite);
// klien lalu menyimpan di localStorage.
import { dbJaga } from "@/lib/jaga/penyedia";
import {
  hapusPortofolio,
  muatPortofolio,
  PortofolioBodySchema,
  SahamGandaError,
  simpanPortofolio,
  tokenDariHeader,
} from "@/lib/jaga/portofolio";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function galat(status: number, kode: string, pesan: string, rincian?: unknown) {
  return Response.json({ error: { kode, pesan, ...(rincian !== undefined ? { rincian } : {}) } }, { status });
}

const TANPA_TOKEN = () => galat(401, "TOKEN_TIDAK_ADA", "Header x-owner-token wajib (16–128 karakter).");
const TANPA_DB = () =>
  galat(501, "DB_TIDAK_TERSEDIA", "Server belum punya database; portofolio disimpan di browser ini saja.");

export async function GET(req: Request): Promise<Response> {
  const token = tokenDariHeader(req);
  if (!token) return TANPA_TOKEN();
  try {
    const db = await dbJaga();
    if (!db) return TANPA_DB();
    return Response.json({ portofolio: await muatPortofolio(db, token) });
  } catch (err) {
    console.error("[api/portofolio GET]", err);
    return galat(500, "GALAT_INTERNAL", "Gagal memuat portofolio; coba lagi sesaat.");
  }
}

export async function POST(req: Request): Promise<Response> {
  const token = tokenDariHeader(req);
  if (!token) return TANPA_TOKEN();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return galat(400, "BODY_BUKAN_JSON", "Body harus JSON berisi { symbols, alarmIds? }");
  }
  const parsed = PortofolioBodySchema.safeParse(body);
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
    if (!db) return TANPA_DB();
    const portofolio = await simpanPortofolio(db, token, parsed.data);
    return Response.json({ portofolio });
  } catch (err) {
    if (err instanceof SahamGandaError) {
      return galat(400, "SAHAM_GANDA", `Kode saham ganda: ${err.ganda.join(", ")}. Setiap saham cukup sekali.`, err.ganda);
    }
    console.error("[api/portofolio POST]", err);
    return galat(500, "GALAT_INTERNAL", "Gagal menyimpan portofolio; coba lagi sesaat.");
  }
}

export async function DELETE(req: Request): Promise<Response> {
  const token = tokenDariHeader(req);
  if (!token) return TANPA_TOKEN();
  try {
    const db = await dbJaga();
    if (!db) return TANPA_DB();
    return Response.json({ dihapus: await hapusPortofolio(db, token) });
  } catch (err) {
    console.error("[api/portofolio DELETE]", err);
    return galat(500, "GALAT_INTERNAL", "Gagal menghapus portofolio; coba lagi sesaat.");
  }
}
