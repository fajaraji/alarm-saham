// Pemilih sumber kejadian + universe untuk agent dan /api/backtest.
//
// Satu pintu dengan CLI dan /putar-ulang: `getEventSource()` di engine/sumber
// (Neon/Postgres via DATABASE_URL → PGlite lokal ./.pglite → fixture
// universe-kecil.json). Nol panggilan API Sectors di jalur mana pun.
//
// Seperti scripts/backtest.ts: emiten kena TANPA target_event_date
// (docs/universe-pull.md catatan 4: MENN, TGRA, WSKT) tidak punya kejadian
// target untuk diukur lead-nya — mesin menolaknya — jadi dilewati di sini dan
// dilaporkan di `dilewati` agar jumlahnya jujur di UI.
import { getEventSource, type JenisSumber } from "../engine/sumber";
import type { EventSource, UniverseEntry } from "../engine";

export interface SumberTerpilih {
  source: EventSource;
  /** Universe yang bisa diuji (tanpa emiten kena yang tidak punya target). */
  universe: UniverseEntry[];
  /** Simbol emiten kena yang dilewati karena tidak punya target_event_date. */
  dilewati: string[];
  /** Keterangan aman untuk log/UI (tanpa kredensial). */
  keterangan: string;
  jenis: JenisSumber;
}

export async function pilihSumber(paksaFixture = false): Promise<SumberTerpilih> {
  const s = await getEventSource({ fixture: paksaFixture });
  const semua = await s.universe();
  const tanpaTarget = semua.filter((u) => u.group !== "control" && !u.targetEventDate);
  const universe = semua.filter((u) => !tanpaTarget.includes(u));
  return { source: s.source, universe, dilewati: tanpaTarget.map((u) => u.symbol), keterangan: s.keterangan, jenis: s.jenis };
}

/** true bila sumber adalah database (Neon/Postgres/PGlite) berisi data Sectors nyata. */
export function sumberDariDb(jenis: JenisSumber): boolean {
  return jenis !== "fixture";
}
