// Pemilihan universe uji satu pintu: siapa yang ikut dihitung, dan tanggal
// kejadian target mana yang diukur (tiket 39).
//
// Dua emiten kena dilewati, dan keduanya dilewati karena alasan yang sama:
// kami tidak tahu kapan sahamnya berhenti diperdagangkan, jadi "lebih awal
// berapa bulan" tidak bisa dihitung dengan jujur.
//   1. Tanpa `target_event_date` sama sekali (MENN, TGRA, WSKT).
//   2. Punya tanggal catatan, tetapi feed suspensi kami tidak memuat satu pun
//      suspensi untuk emiten itu (ENVY, PTMR, TGUK). Tanggal catatan delisting
//      terbit bertahun-tahun setelah perdagangannya dihentikan, jadi memakainya
//      akan membesarkan klaim kami sendiri.
//
// Sisanya diukur ke suspensi masalah paling awal (lihat `targetTerukur`),
// ditambah penghentian perdagangan dari pengumuman publik yang belum ada di
// feed kami (SUSPENSI_PUBLIK).
import { suspensiMasalah, targetTerukur } from "./evaluate";
import type { EventSource, UniverseEntry } from "./events";
import { SUSPENSI_PUBLIK } from "../universe/daftar";

export interface UniverseUji {
  /** Kontrol + emiten kena yang tanggal berhenti diperdagangkannya diketahui. */
  universe: UniverseEntry[];
  /** Emiten kena yang dilewati, terurut menurut simbol. */
  dilewati: string[];
}

export async function pilihUniverseUji(semua: readonly UniverseEntry[], source: EventSource): Promise<UniverseUji> {
  const universe: UniverseEntry[] = [];
  const dilewati: string[] = [];
  for (const u of semua) {
    if (u.group === "control") {
      universe.push(u);
      continue;
    }
    if (!u.targetEventDate) {
      dilewati.push(u.symbol);
      continue;
    }
    const events = await source.events(u.symbol);
    const publik = SUSPENSI_PUBLIK[u.symbol] ?? null;
    if (suspensiMasalah(events, u.targetEventDate).length === 0 && !publik) {
      dilewati.push(u.symbol);
      continue;
    }
    universe.push({ ...u, targetEventDate: targetTerukur(u.targetEventDate, events, publik) });
  }
  return { universe, dilewati: dilewati.sort() };
}
