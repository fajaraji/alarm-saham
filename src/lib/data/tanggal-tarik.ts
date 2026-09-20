// Kapan data kelas A terakhir kami tarik dari Sectors (tiket 42).
//
// Data kelas A di database adalah snapshot, bukan aliran langsung: tabel
// suspensi, daftar kuartal, aksi korporasi, dan keuangan diisi oleh
// `npm run pull-universe` dan tidak berubah sendiri. Selama tanggalnya tidak
// terlihat, layar mengaku "data Sectors nyata" tanpa memberi tahu bahwa
// nyatanya berhenti di awal September. Angkanya diambil dari buku kredit
// (setiap panggilan API tercatat di sana), jadi tidak ada tanggal yang diketik
// tangan di mana pun.
import { desc } from "drizzle-orm";

import type { Db } from "../db/client";
import { apiLedger } from "../db/schema";

/** Tanggal (YYYY-MM-DD, UTC) panggilan API terakhir; null bila belum pernah atau tanpa DB. */
export async function tanggalTarikData(db: Db | null): Promise<string | null> {
  if (!db) return null;
  try {
    const baris = await db.select({ at: apiLedger.at }).from(apiLedger).orderBy(desc(apiLedger.at)).limit(1);
    const at = baris[0]?.at;
    return at ? at.toISOString().slice(0, 10) : null;
  } catch {
    // Tanggal data tidak pernah boleh menggagalkan layar yang memuatnya.
    return null;
  }
}
