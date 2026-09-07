// POST /api/portofolio/cek  { symbols, alarmIds?, alarms?, kelasB?, blokB?, today? }
// → { today, sumber, saham[], penjelasan[], kreditTerpakai, panggilanApi, cacheHit, kelasB, runId? }
//
// Kelas A dari DB/PGlite/fixture (nol kredit). Kelas B hanya bila `kelasB: true`
// dan SECTORS_API_KEY ada — dengan cache 24 jam dan cadangan kredit provider.
// `kreditTerpakai` dihitung dari ledger sebelum/sesudah (bukti, bukan taksiran).
import { eq } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/lib/db/client";
import { alarms as tabelAlarm } from "@/lib/db/schema";
import { RuleSchema } from "@/lib/engine/rules";
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

/** Alarm kelas A milik pemilik di tabel `alarms` (tiket 09), satu AlarmJaga per aturan. */
async function alarmDariDb(db: Db, owner: string): Promise<AlarmJaga[]> {
  const rows = await db
    .select({ id: tabelAlarm.id, name: tabelAlarm.name, rules: tabelAlarm.rules })
    .from(tabelAlarm)
    .where(eq(tabelAlarm.ownerToken, owner));
  const hasil: AlarmJaga[] = [];
  for (const r of rows) {
    const aturan = r.rules.map((x) => RuleSchema.safeParse(x)).filter((p) => p.success).map((p) => p.data);
    aturan.forEach((rule, i) => {
      hasil.push({ id: r.id, name: aturan.length > 1 ? `${r.name} (${i + 1})` : r.name, kelas: "A", rule, bawaan: false });
    });
  }
  return hasil;
}

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

    const provider = parsed.data.kelasB ? providerKelasB(db) : undefined;
    const hasil = await cekPortofolio({
      symbols,
      alarms: unik,
      opts: {
        kelasB: parsed.data.kelasB,
        blokB: parsed.data.blokB,
        today: parsed.data.today,
        source: sumber.source,
        universe: await sumber.universe(),
        provider: provider ?? null,
        keteranganSumber: sumber.keterangan,
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
      kelasB: parsed.data.kelasB && Boolean(provider),
      ...(runId ? { runId } : {}),
    });
  } catch (err) {
    console.error("[api/portofolio/cek]", err);
    return galat(500, "GALAT_INTERNAL", "Gagal mengecek portofolio; coba lagi sesaat.");
  }
}
