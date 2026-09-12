// Migrasi ledger & cache Sectors ke tabel api_ledger / api_cache di DB tujuan.
// Sumber: folder berkas `.cache/sectors/` (ledger.jsonl + respons) ATAU DB lain
// (mis. PGlite lokal → Neon). Idempoten: baris ledger yang sudah ada (kunci
// ts+endpoint+params+status+credits+cacheHit) dan kunci cache yang sudah ada
// di tujuan dilewati, sehingga menjalankan dua kali tidak menggandakan apa pun.
import type { Db } from "../db/client";
import { createCacheRepo } from "../db/repos/cache";
import { createLedgerRepo } from "../db/repos/ledger";
import { apiCache } from "../db/schema";
import { CacheRespons, type EntriCache } from "./cache";
import { LedgerDb, barisKeEntri } from "./db-store";
import { Ledger, type BarisLedger } from "./ledger";

export interface SumberMigrasi {
  ledger: BarisLedger[];
  cache: Array<{ kunci: string; entri: EntriCache }>;
}

export interface HasilMigrasi {
  ledgerDibaca: number;
  ledgerDisisipkan: number;
  ledgerDilewati: number;
  cacheDibaca: number;
  cacheDisisipkan: number;
  cacheDilewati: number;
  kreditDiMigrasi: number;
}

function kunciBaris(b: {
  ts: string;
  endpoint: string;
  params: Record<string, unknown>;
  status: number | null;
  credits: number;
  cacheHit: boolean;
}): string {
  const urut = Object.keys(b.params)
    .sort()
    .map((k) => `${k}=${String(b.params[k])}`)
    .join("&");
  return `${new Date(b.ts).toISOString()}|${b.endpoint}?${urut}|${b.status ?? 0}|${b.credits}|${b.cacheHit ? 1 : 0}`;
}

/** Sumber dari folder berkas `.cache/sectors/`. */
export async function sumberDariBerkas(dirCache: string): Promise<SumberMigrasi> {
  return {
    ledger: await new Ledger(dirCache).semua(),
    cache: await new CacheRespons(dirCache).semuaEntri(),
  };
}

/** Sumber dari DB lain (semua baris api_ledger + api_cache, termasuk yang kedaluwarsa). */
export async function sumberDariDb(dbSumber: Db): Promise<SumberMigrasi> {
  const ledger = await new LedgerDb(dbSumber).semua();
  const rows = await dbSumber.select({ key: apiCache.key, payload: apiCache.payload }).from(apiCache);
  const cache: SumberMigrasi["cache"] = [];
  for (const r of rows) {
    const entri = r.payload as EntriCache | null;
    if (entri && typeof entri === "object" && typeof entri.endpoint === "string") cache.push({ kunci: r.key, entri });
  }
  return { ledger, cache };
}

export async function migrasiKeDb(sumber: SumberMigrasi, db: Db): Promise<HasilMigrasi> {
  const ledgerRepo = createLedgerRepo(db);
  const cacheRepo = createCacheRepo(db);
  const hasil: HasilMigrasi = {
    ledgerDibaca: sumber.ledger.length,
    ledgerDisisipkan: 0,
    ledgerDilewati: 0,
    cacheDibaca: sumber.cache.length,
    cacheDisisipkan: 0,
    cacheDilewati: 0,
    kreditDiMigrasi: 0,
  };

  // --- ledger ---
  const sudahAda = new Set<string>();
  for (const r of await ledgerRepo.all()) {
    sudahAda.add(
      kunciBaris({
        ts: r.at.toISOString(),
        endpoint: r.endpoint,
        params: r.params ?? {},
        status: r.status === 0 ? null : r.status,
        credits: r.credits,
        cacheHit: r.cacheHit === 1,
      }),
    );
  }
  const baru: BarisLedger[] = [];
  for (const b of sumber.ledger) {
    const k = kunciBaris(b);
    if (sudahAda.has(k)) {
      hasil.ledgerDilewati += 1;
      continue;
    }
    sudahAda.add(k);
    baru.push(b);
  }
  // Sisipkan bertahap agar satu permintaan HTTP (Neon) tidak terlalu besar.
  for (let i = 0; i < baru.length; i += 100) {
    const potongan = baru.slice(i, i + 100);
    await ledgerRepo.appendMany(potongan.map(barisKeEntri));
    hasil.ledgerDisisipkan += potongan.length;
    hasil.kreditDiMigrasi += potongan.reduce((a, b) => a + (Number.isFinite(b.credits) ? b.credits : 0), 0);
  }

  // --- cache --- (entri yang sudah ada di tujuan tidak ditimpa: tujuan = sumber kebenaran baru)
  const kunciTujuan = new Set((await db.select({ key: apiCache.key }).from(apiCache)).map((r) => r.key));
  for (const { kunci, entri } of sumber.cache) {
    if (kunciTujuan.has(kunci)) {
      hasil.cacheDilewati += 1;
      continue;
    }
    await cacheRepo.set({
      key: kunci,
      endpoint: entri.endpoint,
      payload: entri,
      ttlMs: entri.ttlMs ?? undefined,
      now: new Date(entri.storedAt),
    });
    kunciTujuan.add(kunci);
    hasil.cacheDisisipkan += 1;
  }
  return hasil;
}

/** Jalan pintas: folder berkas → DB. */
export async function migrasiCacheKeDb(dirCache: string, db: Db): Promise<HasilMigrasi> {
  return migrasiKeDb(await sumberDariBerkas(dirCache), db);
}
