// GET|POST /api/cron/jaga — pengecekan harian (tiket 12), dipanggil Vercel Cron
// 06:30 WIB (vercel.json: "30 23 * * *", zona waktu cron selalu UTC).
//
// Keamanan: wajib `Authorization: Bearer <CRON_SECRET>` (Vercel mengirimnya
// otomatis bila env CRON_SECRET diset). Tanpa CRON_SECRET di server → 503
// (endpoint tidak pernah terbuka tanpa rahasia). Header salah/kosong → 401.
//
// Batas Vercel Hobby (dicatat karena memengaruhi desain):
//   - cron minimal 1×/hari dengan presisi per jam: "30 23" bisa jalan kapan
//     saja 23:00–23:59 UTC (06:00–06:59 WIB); Pro: presisi per menit.
//   - fungsi maks 300 s (maxDuration di bawah) → cron hanya kelas A (nol API,
//     cepat) dan penjelasan template (tanpa LLM).
//   - delivery best-effort (bisa dobel) → job idempoten: run kedua = 0 bendera.
// Hanya GET yang dipanggil Vercel; POST disediakan untuk pemanggilan manual/tes.
import { jalankanPengecekanHarian } from "@/lib/jaga/harian";
import { PengirimInApp, PengirimTelegram, tokenTelegram, type Pengirim } from "@/lib/jaga/pengirim";
import { sumberJaga } from "@/lib/jaga/penyedia";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function galat(status: number, kode: string, pesan: string) {
  return Response.json({ error: { kode, pesan } }, { status });
}

/** Perbandingan panjang-tetap agar waktu respons tidak membocorkan rahasia. */
function samaAman(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let beda = 0;
  for (let i = 0; i < a.length; i++) beda |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return beda === 0;
}

export function otorisasiCron(req: Request, env: NodeJS.ProcessEnv = process.env): Response | null {
  const rahasia = env.CRON_SECRET?.trim();
  if (!rahasia) return galat(503, "CRON_SECRET_BELUM_DIATUR", "CRON_SECRET belum diatur di server; cron dinonaktifkan.");
  const header = req.headers.get("authorization") ?? "";
  if (!samaAman(header, `Bearer ${rahasia}`)) return galat(401, "TIDAK_BERWENANG", "Butuh Authorization: Bearer <CRON_SECRET>.");
  return null;
}

async function jalankan(req: Request): Promise<Response> {
  const tolak = otorisasiCron(req);
  if (tolak) return tolak;
  try {
    const sumber = await sumberJaga();
    if (!sumber.db) return galat(501, "DB_TIDAK_TERSEDIA", "Server belum punya database; tidak ada portofolio untuk dicek.");
    const url = new URL(req.url);
    const today = url.searchParams.get("today") ?? undefined;
    if (today && !/^\d{4}-\d{2}-\d{2}$/.test(today)) return galat(400, "INPUT_TIDAK_VALID", "today harus YYYY-MM-DD");

    const pengirim: Pengirim[] = [new PengirimInApp(sumber.db)];
    const token = tokenTelegram();
    if (token) pengirim.push(new PengirimTelegram({ db: sumber.db, token }));

    const ringkasan = await jalankanPengecekanHarian({
      db: sumber.db,
      source: sumber.source,
      universe: await sumber.universe(),
      keteranganSumber: sumber.keterangan,
      pengirim,
      today,
    });
    return Response.json({ ok: true, telegramAktif: Boolean(token), ...ringkasan });
  } catch (err) {
    console.error("[api/cron/jaga]", err);
    return galat(500, "GALAT_INTERNAL", "Pengecekan harian gagal; lihat log server.");
  }
}

export const GET = jalankan;
export const POST = jalankan;
