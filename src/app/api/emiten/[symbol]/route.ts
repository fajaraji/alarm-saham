// GET  /api/emiten/[symbol]  → data putar ulang satu emiten dari DB/PGlite/fixture (nol panggilan API Sectors).
// POST /api/emiten/[symbol]  → "minta ditarik": hanya mencatat permintaan (JSONL lokal / log).
import { getEventSource } from "@/lib/engine/sumber";
import { catatPermintaanTarik } from "@/lib/putar-ulang/minta-tarik";
import { muatEmitenDariSumber, normalKode } from "@/lib/putar-ulang/muat";

export const dynamic = "force-dynamic";

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

export async function POST(_req: Request, ctx: RouteContext<"/api/emiten/[symbol]">): Promise<Response> {
  const { symbol } = await ctx.params;
  const kode = normalKode(symbol);
  if (!kode) return galat(400, "KODE_TIDAK_SAH", "Kode saham harus 2–5 huruf, mis. SRIL.");
  const hasil = await catatPermintaanTarik(kode);
  return Response.json({
    ok: true,
    pesan: `Permintaan menarik ${kode} sudah dicatat. Penarikan dilakukan manual dengan anggaran kredit; tidak ada panggilan API otomatis.`,
    ...hasil,
  });
}
