// Portofolio per tautan rahasia (PLAN §2): satu baris `portfolios` per
// owner_token (UUID yang dibuat browser, dikirim di header x-owner-token).
// Hasil "cek sekarang" terakhir disimpan ke `runs` (persiapan tiket 12: cron
// membandingkan hasil baru dengan yang terakhir untuk menentukan bendera baru).
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "../db/client";
import { alarms, portfolios, runs } from "../db/schema";
import type { HasilPortofolio } from "./evaluasi";
import type { Penjelasan } from "./penjelasan";

export const HEADER_PEMILIK = "x-owner-token";
export const NAMA_ALARM_JAGA = "Mode jaga";
export const MAKS_SAHAM = 50;

export const TokenSchema = z
  .string({ error: "owner_token harus berupa teks" })
  .trim()
  .min(16, { error: "owner_token terlalu pendek" })
  .max(128, { error: "owner_token terlalu panjang" });

export const KodeSahamSchema = z
  .string({ error: "kode saham harus berupa teks" })
  .trim()
  .toUpperCase()
  .transform((s) => s.replace(/\.JK$/, ""))
  .pipe(z.string().regex(/^[A-Z]{4}$/, { error: "kode saham harus 4 huruf, mis. BBCA" }));

export class SahamGandaError extends Error {
  constructor(readonly ganda: string[]) {
    super(`Saham ganda: ${ganda.join(", ")}`);
    this.name = "SahamGandaError";
  }
}

/** Normalisasi + tolak ganda (melempar SahamGandaError). */
export function normalisasiDaftarSaham(masukan: string[]): string[] {
  const hasil: string[] = [];
  const ganda = new Set<string>();
  for (const m of masukan) {
    const s = KodeSahamSchema.parse(m);
    if (hasil.includes(s)) ganda.add(s);
    else hasil.push(s);
  }
  if (ganda.size) throw new SahamGandaError([...ganda]);
  return hasil;
}

export const PortofolioBodySchema = z.object({
  symbols: z.array(KodeSahamSchema, { error: "symbols harus berupa daftar kode saham" }).max(MAKS_SAHAM, {
    error: `maksimal ${MAKS_SAHAM} saham`,
  }),
  alarmIds: z.array(z.uuid({ error: "alarmIds harus UUID" })).max(50).optional().default([]),
});
export type PortofolioBody = z.infer<typeof PortofolioBodySchema>;

export interface PortofolioTersimpan {
  id: string;
  symbols: string[];
  alarmIds: string[];
  createdAt: string;
}

export function tokenDariHeader(req: Request): string | null {
  const t = req.headers.get(HEADER_PEMILIK);
  const parsed = TokenSchema.safeParse(t ?? "");
  return parsed.success ? parsed.data : null;
}

export async function muatPortofolio(db: Db, owner: string): Promise<PortofolioTersimpan | null> {
  const [b] = await db
    .select()
    .from(portfolios)
    .where(eq(portfolios.ownerToken, owner))
    .orderBy(desc(portfolios.createdAt))
    .limit(1);
  if (!b) return null;
  return { id: b.id, symbols: b.symbols, alarmIds: b.alarmIds, createdAt: b.createdAt.toISOString() };
}

/** Upsert satu portofolio per pemilik; `symbols` sudah dinormalisasi & bebas ganda. */
export async function simpanPortofolio(db: Db, owner: string, body: PortofolioBody): Promise<PortofolioTersimpan> {
  const symbols = normalisasiDaftarSaham(body.symbols);
  const alarmIds = [...new Set(body.alarmIds)];
  const ada = await muatPortofolio(db, owner);
  if (ada) {
    await db.update(portfolios).set({ symbols, alarmIds }).where(eq(portfolios.id, ada.id));
    return { ...ada, symbols, alarmIds };
  }
  const [b] = await db
    .insert(portfolios)
    .values({ ownerToken: owner, symbols, alarmIds })
    .returning({ id: portfolios.id, createdAt: portfolios.createdAt });
  return { id: b.id, symbols, alarmIds, createdAt: b.createdAt.toISOString() };
}

export async function hapusPortofolio(db: Db, owner: string): Promise<number> {
  const dihapus = await db.delete(portfolios).where(eq(portfolios.ownerToken, owner)).returning({ id: portfolios.id });
  return dihapus.length;
}

/** Bendera per saham yang disimpan ringkas agar cron (tiket 12) bisa membandingkan. */
export interface RingkasanJaga {
  symbol: string;
  status: HasilPortofolio["saham"][number]["status"];
  blok: string[];
  alarm: string[];
}

export function ringkasUntukRun(hasil: HasilPortofolio): RingkasanJaga[] {
  return hasil.saham.map((s) => ({
    symbol: s.symbol,
    status: s.status,
    blok: s.alasan.map((a) => a.kind),
    alarm: s.alarmBerbunyi.map((a) => a.name),
  }));
}

/**
 * Simpan hasil cek ke `runs`. Tabel `runs` wajib merujuk `alarms`, maka satu
 * baris alarm "Mode jaga" per pemilik dibuat sekali dan dipakai ulang.
 * Tidak melempar — kegagalan hanya dicatat.
 */
export async function simpanRunJaga(
  db: Db,
  owner: string,
  portfolioId: string | null,
  hasil: HasilPortofolio,
  penjelasan: Penjelasan[],
): Promise<string | undefined> {
  try {
    let [a] = await db
      .select({ id: alarms.id })
      .from(alarms)
      .where(and(eq(alarms.ownerToken, owner), eq(alarms.name, NAMA_ALARM_JAGA)))
      .limit(1);
    if (!a) {
      [a] = await db
        .insert(alarms)
        .values({ ownerToken: owner, name: NAMA_ALARM_JAGA, rules: [] })
        .returning({ id: alarms.id });
    }
    const ringkas = ringkasUntukRun(hasil);
    const [r] = await db
      .insert(runs)
      .values({
        alarmId: a.id,
        score: {
          hijau: ringkas.filter((s) => s.status === "hijau").length,
          kuning: ringkas.filter((s) => s.status === "kuning").length,
          merah: ringkas.filter((s) => s.status === "merah").length,
          kreditTerpakai: hasil.kreditTerpakai,
        },
        details: {
          jenis: "jaga",
          portfolioId,
          today: hasil.today,
          sumber: hasil.sumber,
          saham: ringkas,
          penjelasan: penjelasan.map((p) => ({ symbol: p.symbol, teks: p.teks, olehAi: p.olehAi })),
        },
      })
      .returning({ id: runs.id });
    return r.id;
  } catch (err) {
    console.warn(`[jaga] hasil cek tidak tersimpan ke runs: ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }
}

/** Hasil cek terakhir milik pemilik (untuk membandingkan bendera baru). */
export async function runTerakhirJaga(db: Db, owner: string): Promise<RingkasanJaga[] | null> {
  const [a] = await db
    .select({ id: alarms.id })
    .from(alarms)
    .where(and(eq(alarms.ownerToken, owner), eq(alarms.name, NAMA_ALARM_JAGA)))
    .limit(1);
  if (!a) return null;
  const [r] = await db.select({ details: runs.details }).from(runs).where(eq(runs.alarmId, a.id)).orderBy(desc(runs.ranAt)).limit(1);
  const saham = (r?.details as { saham?: RingkasanJaga[] } | undefined)?.saham;
  return Array.isArray(saham) ? saham : null;
}
