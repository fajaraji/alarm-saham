// /api/inbox — kotak masuk in-app per pemilik (header x-owner-token).
//   GET   → { pesan: PesanKotakMasuk[], belumDibaca }   (terbaru dulu, maks 50)
//   PATCH → { dibaca }                                   tandai semua sudah dibaca
// 401 tanpa token; 501 DB_TIDAK_TERSEDIA bila server hanya punya fixture.
// Diisi oleh cron harian (tiket 12) — jalur utama saat TELEGRAM_BOT_TOKEN kosong.
import { jumlahBelumDibaca, muatKotakMasuk, tandaiKotakMasukDibaca } from "@/lib/jaga/inbox";
import { dbJaga } from "@/lib/jaga/penyedia";
import { tokenDariHeader } from "@/lib/jaga/portofolio";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function galat(status: number, kode: string, pesan: string) {
  return Response.json({ error: { kode, pesan } }, { status });
}

const TANPA_TOKEN = () => galat(401, "TOKEN_TIDAK_ADA", "Header x-owner-token wajib (16–128 karakter).");
const TANPA_DB = () => galat(501, "DB_TIDAK_TERSEDIA", "Server belum punya database; kotak masuk hanya tersimpan di browser ini.");

export async function GET(req: Request): Promise<Response> {
  const token = tokenDariHeader(req);
  if (!token) return TANPA_TOKEN();
  try {
    const db = await dbJaga();
    if (!db) return TANPA_DB();
    const [pesan, belumDibaca] = await Promise.all([muatKotakMasuk(db, token), jumlahBelumDibaca(db, token)]);
    return Response.json({ pesan, belumDibaca });
  } catch (err) {
    console.error("[api/inbox GET]", err);
    return galat(500, "GALAT_INTERNAL", "Gagal memuat kotak masuk; coba lagi sesaat.");
  }
}

export async function PATCH(req: Request): Promise<Response> {
  const token = tokenDariHeader(req);
  if (!token) return TANPA_TOKEN();
  try {
    const db = await dbJaga();
    if (!db) return TANPA_DB();
    return Response.json({ dibaca: await tandaiKotakMasukDibaca(db, token) });
  } catch (err) {
    console.error("[api/inbox PATCH]", err);
    return galat(500, "GALAT_INTERNAL", "Gagal menandai kotak masuk; coba lagi sesaat.");
  }
}
