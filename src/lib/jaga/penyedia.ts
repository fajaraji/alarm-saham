// Penyedia untuk route mode jaga (server): sumber kejadian kelas A satu pintu
// (`getEventSource`: Neon → PGlite → fixture) dan provider Sectors kelas B yang
// ledger/cache-nya ikut DB yang sama bila ada (api_ledger/api_cache), agar
// kredit terpakai terbaca dari satu buku dan cache 24 jam bertahan lintas proses.
import { CacheDb, LedgerDb } from "../data/db-store";
import { sectorsProviderDariEnv, type SectorsProvider } from "../data/sectors-provider";
import type { Db } from "../db/client";
import { getEventSource, type SumberKejadian } from "../engine/sumber";

export async function sumberJaga(): Promise<SumberKejadian> {
  return getEventSource();
}

/** DB untuk portofolio/runs; null bila hanya fixture (route menjawab 501). */
export async function dbJaga(): Promise<Db | null> {
  return (await sumberJaga()).db;
}

/**
 * Provider Sectors untuk kelas B; undefined bila SECTORS_API_KEY kosong ATAU
 * server tidak punya database.
 *
 * Tanpa DB, ledger & cache jatuh ke berkas `.cache/sectors/…`. Di serverless
 * (Vercel) sistem berkasnya hanya-baca dan tiap invocation mulai dari nol,
 * sehingga `sisaKredit()` selalu = anggaran penuh: pagar SECTORS_CREDIT_RESERVE
 * tidak pernah menolak, pemakaian kredit tidak pernah tercatat, dan cache 24 jam
 * tidak pernah kena. Lebih baik kelas B dilewati dengan jujur daripada
 * membelanjakan kredit tim tanpa buku.
 */
export function providerKelasB(db: Db | null): SectorsProvider | undefined {
  if (!db) return undefined;
  return sectorsProviderDariEnv(process.env, { ledger: new LedgerDb(db), cache: new CacheDb(db) });
}
