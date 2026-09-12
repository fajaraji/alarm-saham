// POST /api/portofolio/cek  { symbols, alarmIds?, alarms?, kelasB?, blokB?, today? }
// → { today, sumber, saham[], penjelasan[], kreditTerpakai, panggilanApi, cacheHit, kelasB, runId? }
//
// Kelas A dari DB/PGlite/fixture (nol kredit). Kelas B hanya bila `kelasB: true`
// dan SECTORS_API_KEY ada — dengan cache 24 jam dan cadangan kredit provider.
// `kreditTerpakai` dihitung dari ledger sebelum/sesudah (bukti, bukan taksiran).
import { z } from "zod";

import { jawabanTerlaluSering, kunciEmber, kunciPemanggil, kunciPemanggilServer, pagarLaju } from "@/lib/api/pagar";
import { alarmDariDb } from "@/lib/jaga/alarm-db";
import { ALARM_BAWAAN, alarmDariKlien, AlarmKlienSchema, BlokBSchema, type AlarmJaga } from "@/lib/jaga/bawaan";
import { cekPortofolio } from "@/lib/jaga/evaluasi";
import { penjelasanPortofolio } from "@/lib/jaga/penjelasan";
import { providerKelasB, sumberJaga } from "@/lib/jaga/penyedia";
import {
  KodeSahamSchema,
  MAKS_SAHAM,
  muatPortofolio,
  normalisasiDaftarSaham,
  SahamGandaError,
  simpanRunJaga,
  tokenDariHeader,
} from "@/lib/jaga/portofolio";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BodySchema = z.object({
  symbols: z.array(KodeSahamSchema).min(1, { error: "minimal 1 saham" }).max(MAKS_SAHAM),
  /** ID alarm yang aktif (bawaan, DB, atau lokal). Tidak dikirim = semua bawaan aktif. */
  alarmIds: z.array(z.string().trim().min(1).max(64)).max(100).optional(),
  /** Alarm buatan pengguna yang tersimpan di browser. */
  alarms: z.array(AlarmKlienSchema).max(20).optional().default([]),
  kelasB: z.boolean().optional().default(false),
  blokB: z.array(BlokBSchema).optional(),
  today: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "today harus YYYY-MM-DD" })
    .optional(),
});

function galat(status: number, kode: string, pesan: string, rincian?: unknown) {
  return Response.json({ error: { kode, pesan, ...(rincian !== undefined ? { rincian } : {}) } }, { status });
}

/**
 * Route ini publik (produk memang tanpa akun), tetapi permintaan "data terkini"
 * (kelas B) MEMBELANJAKAN kredit Sectors tim. Karena itu kelas B dibatasi:
 * wajib membawa tautan rahasia (x-owner-token), maksimum MAKS_SAHAM_KELAS_B
 * saham per permintaan, dan jauh lebih jarang daripada kelas A yang nol kredit.
 */
const MAKS_SAHAM_KELAS_B = 10;
const PAGAR_KELAS_A = { maks: 60, jendelaMs: 60_000 };
const PAGAR_KELAS_B = { maks: 6, jendelaMs: 10 * 60_000 };
/**
 * Ember kedua untuk kelas B: batas mutlak seluruh instance, tanpa peduli siapa
 * pemanggilnya. Pagar per-IP saja masih bisa disebar lewat banyak alamat;
 * kredit Sectors tim tidak ikut bertambah kalau alamatnya banyak.
 */
const PAGAR_KELAS_B_GLOBAL = { maks: 30, jendelaMs: 10 * 60_000 };
const KUNCI_KELAS_B_GLOBAL = kunciEmber("cek-kelas-b", "global");

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return galat(400, "BODY_BUKAN_JSON", "Body harus JSON berisi { symbols, alarmIds?, kelasB? }");
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
  let symbols: string[];
  try {
    symbols = normalisasiDaftarSaham(parsed.data.symbols);
  } catch (err) {
    if (err instanceof SahamGandaError) {
      return galat(400, "SAHAM_GANDA", `Kode saham ganda: ${err.ganda.join(", ")}. Setiap saham cukup sekali.`, err.ganda);
    }
    throw err;
  }

  const token = tokenDariHeader(req);
  const kelasB = parsed.data.kelasB;
  if (kelasB) {
    if (!token) {
      return galat(
        401,
        "BUTUH_TAUTAN_RAHASIA",
        "Data terkini (yang memakai kredit Sectors) hanya untuk portofolio yang tersimpan. Buka layar Pasang lebih dulu agar tautan rahasianya dibuat.",
      );
    }
    if (symbols.length > MAKS_SAHAM_KELAS_B) {
      return galat(
        400,
        "TERLALU_BANYAK_SAHAM",
        `Data terkini dibatasi ${MAKS_SAHAM_KELAS_B} saham sekali cek (setiap saham memakai kredit Sectors). Kamu mengirim ${symbols.length}.`,
      );
    }
  }
  // Kunci ember TIDAK boleh berasal dari nilai pilihan klien: `x-owner-token`
  // dibuat sendiri oleh peramban (UUID di localStorage, tanpa pendaftaran),
  // jadi token yang diganti tiap permintaan dulu selalu mendapat kuota kosong.
  // Kelas B memakai identitas server murni (IP menurut proksi) + ember global.
  //
  // Ember kelas A dan kelas B TERPISAH (`kunciEmber`). Saat keduanya berbagi
  // satu kunci `ip:<IP>`, enam klik "Cek sekarang" yang nol kredit menghabiskan
  // jatah 6-per-10-menit kelas B, sehingga permintaan "Sertakan data terkini"
  // yang pertama langsung ditolak 429.
  const pagar = pagarLaju(
    kelasB
      ? kunciEmber("cek-kelas-b", kunciPemanggilServer(req))
      : kunciEmber("cek-kelas-a", kunciPemanggil(req, token)),
    kelasB ? PAGAR_KELAS_B : PAGAR_KELAS_A,
  );
  if (!pagar.lolos) return jawabanTerlaluSering(pagar.tungguDetik);
  if (kelasB) {
    const global = pagarLaju(KUNCI_KELAS_B_GLOBAL, PAGAR_KELAS_B_GLOBAL);
    if (!global.lolos) return jawabanTerlaluSering(global.tungguDetik);
  }

  // `today` dari klien hanya untuk tes deterministik. Di produksi ia diabaikan
  // supaya tidak bisa dipakai menggeser jendela tanggal sehari demi sehari untuk
  // melewati cache 24 jam dan membeli kredit baru tiap permintaan. Di server,
  // tanggal dipakukan lewat env ALARM_HARI_INI (lihat src/lib/engine/dates.ts).
  const today = process.env.NODE_ENV === "production" ? undefined : parsed.data.today;

  try {
    const sumber = await sumberJaga();
    const db = sumber.db;

    // Alarm aktif: bawaan + DB (pemilik) + lokal (dikirim klien), disaring alarmIds.
    const kandidat: AlarmJaga[] = [...ALARM_BAWAAN];
    if (db && token) kandidat.push(...(await alarmDariDb(db, token)));
    kandidat.push(...parsed.data.alarms.map(alarmDariKlien));
    const ids = parsed.data.alarmIds ? new Set(parsed.data.alarmIds) : null;
    const aktif = ids ? kandidat.filter((a) => ids.has(a.id)) : kandidat.filter((a) => a.bawaan);
    const unik = [...new Map(aktif.map((a) => [`${a.id}:${a.name}`, a])).values()];

    const provider = kelasB ? providerKelasB(db) : undefined;
    const hasil = await cekPortofolio({
      symbols,
      alarms: unik,
      opts: {
        kelasB,
        blokB: parsed.data.blokB,
        today,
        source: sumber.source,
        universe: await sumber.universe(),
        provider: provider ?? null,
        keteranganSumber: sumber.keterangan,
        sumberContoh: sumber.jenis === "fixture",
      },
    });
    const penjelasan = await penjelasanPortofolio(hasil);

    let runId: string | undefined;
    if (db && token) {
      const p = await muatPortofolio(db, token);
      runId = await simpanRunJaga(db, token, p?.id ?? null, hasil, penjelasan);
    }

    return Response.json({
      today: hasil.today,
      sumber: hasil.sumber,
      saham: hasil.saham,
      penjelasan,
      kreditTerpakai: hasil.kreditTerpakai,
      panggilanApi: hasil.panggilanApi,
      cacheHit: hasil.cacheHit,
      kelasB: kelasB && Boolean(provider),
      ...(runId ? { runId } : {}),
    });
  } catch (err) {
    console.error("[api/portofolio/cek]", err);
    return galat(500, "GALAT_INTERNAL", "Gagal mengecek portofolio; coba lagi sesaat.");
  }
}
