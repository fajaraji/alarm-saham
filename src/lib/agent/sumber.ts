// Pemilih sumber kejadian + universe untuk agent dan /api/backtest.
//
// Satu pintu dengan CLI dan /putar-ulang: `getEventSource()` di engine/sumber
// (Neon/Postgres via DATABASE_URL → PGlite lokal ./.pglite → fixture
// universe-kecil.json). Nol panggilan API Sectors di jalur mana pun.
//
// Emiten kena yang tanggal berhenti diperdagangkannya tidak diketahui dilewati
// oleh `pilihUniverseUji` (engine/universe-uji.ts) dan dilaporkan di `dilewati`
// agar jumlah di layar jujur.
import type { Db } from "../db/client";
import { getEventSource, type JenisSumber } from "../engine/sumber";
import { pilihUniverseUji } from "../engine/universe-uji";
import type { EventSource, UniverseEntry } from "../engine";

export interface SumberTerpilih {
  source: EventSource;
  /** Universe yang bisa diuji (tanpa emiten kena yang tidak punya target). */
  universe: UniverseEntry[];
  /** Simbol emiten kena yang dilewati karena tanggal berhentinya tidak diketahui. */
  dilewati: string[];
  /** Koneksi Drizzle sumber ini; null untuk data contoh. */
  db: Db | null;
  /** Keterangan aman untuk log/UI (tanpa kredensial). */
  keterangan: string;
  jenis: JenisSumber;
}

export async function pilihSumber(paksaFixture = false): Promise<SumberTerpilih> {
  const s = await getEventSource({ fixture: paksaFixture });
  const semua = await s.universe();
  const { universe, dilewati } = await pilihUniverseUji(semua, s.source);
  return { source: s.source, universe, dilewati, db: s.db, keterangan: s.keterangan, jenis: s.jenis };
}

/** true bila sumber adalah database (Neon/Postgres/PGlite) berisi data Sectors nyata. */
export function sumberDariDb(jenis: JenisSumber): boolean {
  return jenis !== "fixture";
}
