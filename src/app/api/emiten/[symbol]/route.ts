// GET  /api/emiten/[symbol]  → data putar ulang satu emiten dari DB/PGlite/fixture (nol panggilan API Sectors).
// POST /api/emiten/[symbol]  → "minta ditarik": hanya mencatat permintaan (JSONL lokal / log).
import { jawabanTerlaluSering, kunciPemanggil, pagarLaju } from "@/lib/api/pagar";
import { getEventSource } from "@/lib/engine/sumber";
import { catatPermintaanTarik } from "@/lib/putar-ulang/minta-tarik";
import { muatEmitenDariSumber, normalKode } from "@/lib/putar-ulang/muat";

export const dynamic = "force-dynamic";

/** POST hanya menulis satu baris catatan; dibatasi agar tidak dipakai membanjiri log. */
const PAGAR_MINTA_TARIK = { maks: 20, jendelaMs: 60_000 };

function galat(status: number, kode: string, pesan: string) {
  return Response.json({ error: { kode, pesan } }, { status });
}

export async function GET(req: Request, ctx: RouteContext<"/api/emiten/[symbol]">): Promise<Response> {
  const { symbol } = await ctx.params;
  const kode = normalKode(symbol);
  if (!kode) return galat(400, "KODE_TIDAK_SAH", "Kode saham harus 2–5 huruf, mis. SRIL.");
  const today = new URL(req.url).searchParams.get("today") ?? undefined;
  try {
    const sumber = await getEventSource();
    const emiten = await muatEmitenDariSumber(sumber, kode, today);
    if (emiten.status === "tidak_ada") {
      return Response.json(
        { ...emiten, pesan: `${kode} belum ada di data kami.`, sumber: sumber.keterangan },
        { status: 404 },
      );
    }
    return Response.json({ ...emiten, sumber: sumber.keterangan });
  } catch (err) {
    if (err instanceof Error && /harus berformat YYYY-MM-DD/.test(err.message)) {
      return galat(400, "TANGGAL_TIDAK_SAH", err.message);
    }
    console.error("[api/emiten]", err);
    return galat(500, "GALAT_INTERNAL", "Gagal memuat data emiten; coba lagi sesaat.");
  }
}

export async function POST(req: Request, ctx: RouteContext<"/api/emiten/[symbol]">): Promise<Response> {
  const { symbol } = await ctx.params;
  const kode = normalKode(symbol);
  if (!kode) return galat(400, "KODE_TIDAK_SAH", "Kode saham harus 2–5 huruf, mis. SRIL.");
  const pagar = pagarLaju(kunciPemanggil(req), PAGAR_MINTA_TARIK);
  if (!pagar.lolos) return jawabanTerlaluSering(pagar.tungguDetik);
  const hasil = await catatPermintaanTarik(kode);
  // Jujur soal ke mana permintaan pergi: di serverless sistem berkasnya
  // hanya-baca, jadi yang terjadi hanyalah satu baris di log fungsi.
  const kemana =
    hasil.disimpanDi === "berkas"
      ? "sudah dicatat di berkas permintaan server"
      : "sudah diteruskan ke log server (server ini tidak bisa menulis berkas)";
  return Response.json({
    ok: true,
    pesan: `Permintaan menarik ${kode} ${kemana}. Penarikan dilakukan manual dengan anggaran kredit; tidak ada panggilan API otomatis.`,
    ...hasil,
  });
}
