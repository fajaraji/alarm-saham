// Daftar emiten yang BENAR-BENAR bisa dicari di /putar-ulang, untuk saran
// ketik (native <datalist>).
//
// Kenapa ada: kotak cari sudah lama menerima kode apa pun, tetapi satu-satunya
// yang KELIHATAN di layar adalah enam chip "Kasus nyata". Pemilik membacanya
// sebagai "cuma enam ini yang ada di database", padahal jalur database memuat
// 363 emiten (107 universe uji + 329 emiten yang pernah muncul di feed suspensi
// bursa, 363 unik). Jumlahnya tidak dipakukan di sini: ia dihitung dari sumber
// yang benar-benar dipakai server, aturan yang sama dengan src/lib/cakupan.ts.
//
// Nama perusahaan hanya dimiliki emiten universe (106 dari 107); 256 emiten
// yang hanya muncul di feed suspensi tidak punya baris `symbols`, jadi namanya
// null dan saran ketiknya menampilkan kodenya saja. Itu jujur: kami memang
// tidak menarik profil mereka.
import type { Db } from "../db/client";
import { schema } from "../db";
import type { UniverseEntry } from "../engine";

export interface OpsiCari {
  symbol: string;
  /** Nama perusahaan bila ada; null untuk emiten yang hanya ada di feed suspensi. */
  nama: string | null;
}

/** Batas jumlah saran yang dikirim ke HTML. 363 entri ≈ 16 KB mentah, ≈ 4 KB gzip. */
export const MAKS_SARAN = 500;

function urut(a: OpsiCari, b: OpsiCari): number {
  return a.symbol.localeCompare(b.symbol);
}

/**
 * Emiten yang bisa dicari, dari sumber yang sedang dipakai.
 *
 * Jalur fixture (tanpa DATABASE_URL dan tanpa ./.pglite) hanya mengembalikan
 * universe contohnya, karena memang hanya itu yang ada. Dua query terpisah lalu
 * digabung di JavaScript, bukan satu SQL `union`: query builder Drizzle harus
 * berjalan sama di Neon dan PGlite, dan 363 baris terlalu sedikit untuk pantas
 * dioptimalkan.
 */
export async function daftarBisaDicari(db: Db | null, universe: UniverseEntry[]): Promise<OpsiCari[]> {
  // `UniverseEntry` sengaja tidak memuat nama perusahaan (mesin uji tidak
  // memerlukannya), jadi jalur data contoh menyarankan kodenya saja.
  if (!db) return universe.map((u) => ({ symbol: u.symbol, nama: null })).sort(urut);
  const [baris, feed] = await Promise.all([
    db.select({ symbol: schema.symbols.symbol, nama: schema.symbols.companyName }).from(schema.symbols),
    db.selectDistinct({ symbol: schema.suspensions.symbol }).from(schema.suspensions),
  ]);
  const peta = new Map<string, string | null>();
  for (const { symbol } of feed) peta.set(symbol, null);
  // Baris `symbols` menang: ia yang punya nama perusahaan.
  for (const { symbol, nama } of baris) peta.set(symbol, nama ?? null);
  return [...peta]
    .map(([symbol, nama]) => ({ symbol, nama }))
    .sort(urut)
    .slice(0, MAKS_SARAN);
}
