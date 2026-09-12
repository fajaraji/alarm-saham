// Pengecekan harian (tiket 12) — dipanggil Vercel Cron 06:30 WIB lewat
// /api/cron/jaga. Untuk setiap portofolio yang punya >= 1 alarm aktif:
//   1. jalankan cekPortofolio KELAS A SAJA (nol kredit; kelas B tidak pernah
//      dijalankan dari cron agar kredit Sectors tidak terpakai tanpa
//      sepengetahuan pengguna),
//   2. bandingkan dengan hasil `runs` terakhir pemilik → hanya BENDERA BARU
//      (saham yang memburuk atau alarm yang baru berbunyi),
//   3. simpan run baru (sehingga pemanggilan berikutnya tidak mengulang),
//   4. kirim lewat setiap `Pengirim` (in-app selalu; Telegram bila ada).
// Idempoten terhadap pemanggilan ganda Vercel (best-effort delivery): run kedua
// di hari yang sama menemukan 0 bendera baru.
import { desc } from "drizzle-orm";

import type { Db } from "../db/client";
import { portfolios } from "../db/schema";
import type { EventSource, UniverseEntry } from "../engine/events";
import { alarmDariDb } from "./alarm-db";
import { ALARM_BAWAAN, type AlarmJaga } from "./bawaan";
import { cekPortofolio, type HasilPortofolio, type StatusSaham } from "./evaluasi";
import { penjelasanPortofolio, type Penjelasan } from "./penjelasan";
import type { BenderaBaru, KirimanHarian, NamaPengirim, Pengirim } from "./pengirim";
import { runTerakhirJaga, simpanRunJaga, type RingkasanJaga } from "./portofolio";

const URUTAN: Record<StatusSaham, number> = { hijau: 0, kuning: 1, merah: 2 };

/** Tanggal WIB (UTC+7) saat ini — cron 23:30 UTC = 06:30 WIB hari berikutnya. */
export function tanggalWib(sekarang: Date = new Date()): string {
  return new Date(sekarang.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * Bendera baru dibanding ringkasan run terakhir (murni; paritas dengan
 * `turunkanBendera` di klien, tetapi di atas RingkasanJaga yang tersimpan di
 * `runs.details`). Run pertama: semua saham kuning/merah menjadi bendera.
 */
export function benderaBaru(sebelum: RingkasanJaga[] | null, hasil: HasilPortofolio, penjelasan: Penjelasan[]): BenderaBaru[] {
  const lama = new Map((sebelum ?? []).map((s) => [s.symbol, s]));
  const keluar: BenderaBaru[] = [];
  for (const s of hasil.saham) {
    const l = lama.get(s.symbol);
    const alarmLama = new Set(l?.alarm ?? []);
    const alarmBaru = s.alarmBerbunyi.filter((a) => !alarmLama.has(a.name));
    const memburuk = l ? URUTAN[s.status] > URUTAN[l.status] : s.status !== "hijau";
    if (!memburuk && alarmBaru.length === 0) continue;
    const judul = alarmBaru.length
      ? `${s.symbol}: alarm ${alarmBaru.map((a) => `“${a.name}”`).join(", ")} berbunyi`
      : `${s.symbol}: status ${l ? `${l.status} → ` : ""}${s.status}`;
    keluar.push({
      symbol: s.symbol,
      status: s.status,
      judul,
      teks: penjelasan.find((p) => p.symbol === s.symbol)?.teks ?? "",
    });
  }
  return keluar;
}

export interface OpsiHarian {
  db: Db;
  source: EventSource;
  universe?: UniverseEntry[];
  keteranganSumber?: string;
  pengirim: Pengirim[];
  /** Default: tanggal WIB hari ini. */
  today?: string;
  /**
   * Rapikan penjelasan lewat model AI bila kuncinya ada. Default false: cron
   * memakai template deterministik agar puluhan portofolio selesai jauh di
   * bawah batas 300 detik Vercel Hobby dan tanpa biaya LLM.
   */
  pakaiAi?: boolean;
}

export interface RingkasanHarian {
  today: string;
  /** Portofolio yang diproses (punya saham & alarm kelas A aktif). */
  portofolio: number;
  /** Portofolio dilewati: tanpa saham atau tanpa alarm kelas A aktif. */
  dilewati: number;
  benderaBaru: number;
  terkirim: Record<NamaPengirim, number>;
  /** Kesalahan per portofolio (tidak menghentikan yang lain). */
  galat: string[];
  durasiMs: number;
}

interface PortofolioCron {
  id: string;
  owner: string;
  symbols: string[];
  alarmIds: string[];
}

/** Satu portofolio per pemilik (baris terbaru), hanya yang punya saham & alarm. */
export async function portofolioUntukCron(db: Db): Promise<{ dipakai: PortofolioCron[]; dilewati: number }> {
  const rows = await db.select().from(portfolios).orderBy(desc(portfolios.createdAt));
  const perOwner = new Map<string, PortofolioCron>();
  let dilewati = 0;
  for (const r of rows) {
    if (perOwner.has(r.ownerToken)) continue;
    perOwner.set(r.ownerToken, { id: r.id, owner: r.ownerToken, symbols: r.symbols, alarmIds: r.alarmIds });
  }
  const dipakai: PortofolioCron[] = [];
  for (const p of perOwner.values()) {
    if (p.symbols.length === 0 || p.alarmIds.length === 0) dilewati += 1;
    else dipakai.push(p);
  }
  return { dipakai, dilewati };
}

/** Alarm kelas A yang aktif untuk portofolio ini: bawaan + milik pemilik di DB, disaring alarmIds. */
export async function alarmAktifKelasA(db: Db, p: PortofolioCron): Promise<AlarmJaga[]> {
  const kandidat: AlarmJaga[] = [...ALARM_BAWAAN.filter((a) => a.kelas === "A"), ...(await alarmDariDb(db, p.owner))];
  const ids = new Set(p.alarmIds);
  const aktif = kandidat.filter((a) => a.kelas === "A" && a.rule && ids.has(a.id));
  return [...new Map(aktif.map((a) => [`${a.id}:${a.name}`, a])).values()];
}

export async function jalankanPengecekanHarian(opsi: OpsiHarian): Promise<RingkasanHarian> {
  const mulai = Date.now();
  const today = opsi.today ?? tanggalWib();
  const terkirim: Record<NamaPengirim, number> = { inapp: 0, telegram: 0 };
  const galat: string[] = [];
  let diproses = 0;
  let totalBendera = 0;

  const { dipakai, dilewati: tanpaIsi } = await portofolioUntukCron(opsi.db);
  let dilewati = tanpaIsi;

  for (const p of dipakai) {
    try {
      const alarms = await alarmAktifKelasA(opsi.db, p);
      if (alarms.length === 0) {
        dilewati += 1;
        continue;
      }
      const hasil = await cekPortofolio({
        symbols: p.symbols,
        alarms,
        opts: {
          kelasB: false, // kelas A saja: nol kredit Sectors dari cron
          today,
          source: opsi.source,
          universe: opsi.universe,
          provider: null,
          keteranganSumber: opsi.keteranganSumber,
        },
      });
      const penjelasan = await penjelasanPortofolio(hasil, { pakaiAi: opsi.pakaiAi ?? false });
      const sebelum = await runTerakhirJaga(opsi.db, p.owner);
      const bendera = benderaBaru(sebelum, hasil, penjelasan);
      const runId = (await simpanRunJaga(opsi.db, p.owner, p.id, hasil, penjelasan)) ?? null;
      diproses += 1;
      totalBendera += bendera.length;
      if (bendera.length === 0) continue;

      const kiriman: KirimanHarian = { owner: p.owner, portfolioId: p.id, runId, today, bendera };
      for (const pg of opsi.pengirim) {
        try {
          terkirim[pg.nama] += await pg.kirim(kiriman);
        } catch (err) {
          galat.push(`${pg.nama} ${p.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } catch (err) {
      galat.push(`portofolio ${p.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { today, portofolio: diproses, dilewati, benderaBaru: totalBendera, terkirim, galat, durasiMs: Date.now() - mulai };
}
