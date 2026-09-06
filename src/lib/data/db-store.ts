// Penyimpan ledger & cache Sectors di database (tabel api_ledger / api_cache),
// pengganti berkas `.cache/sectors/` bila DATABASE_URL terisi. Bentuk entri
// dipertahankan persis (EntriCache disimpan utuh sebagai payload) sehingga
// semantik 404-di-cache dan TTL sama dengan penyimpan berkas.
import type { Db } from "../db/client";
import { createCacheRepo, type CacheRepo } from "../db/repos/cache";
import { createLedgerRepo, type LedgerRepo } from "../db/repos/ledger";
import { kunciCache, type EntriCache, type PenyimpanCache } from "./cache";
import type { BarisLedger, PenyimpanLedger } from "./ledger";

/** Status HTTP `null` (gagal jaringan) disimpan sebagai 0 karena kolom NOT NULL. */
const STATUS_GAGAL_JARINGAN = 0;

export class LedgerDb implements PenyimpanLedger {
  private readonly repo: LedgerRepo;

  constructor(db: Db) {
    this.repo = createLedgerRepo(db);
  }

  async catat(baris: BarisLedger): Promise<void> {
    await this.repo.append(barisKeEntri(baris));
  }

  async semua(): Promise<BarisLedger[]> {
    const rows = await this.repo.all();
    return rows.map((r) => ({
      ts: r.at.toISOString(),
      endpoint: r.endpoint,
      params: (r.params ?? {}) as Record<string, string>,
      status: r.status === STATUS_GAGAL_JARINGAN ? null : r.status,
      credits: r.credits,
      cacheHit: r.cacheHit === 1,
      ...(r.note ? { note: r.note } : {}),
    }));
  }

  async totalKredit(): Promise<number> {
    return (await this.repo.total()).credits;
  }
}

export function barisKeEntri(b: BarisLedger) {
  return {
    endpoint: b.endpoint,
    params: b.params,
    status: b.status ?? STATUS_GAGAL_JARINGAN,
    credits: Number.isFinite(b.credits) ? b.credits : 0,
    cacheHit: b.cacheHit,
    at: new Date(b.ts),
    ...(b.note ? { note: b.note } : {}),
  };
}

export class CacheDb implements PenyimpanCache {
  private readonly repo: CacheRepo;

  constructor(
    db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.repo = createCacheRepo(db);
  }

  async baca(endpoint: string, params: Record<string, string>): Promise<EntriCache | null> {
    const entri = await this.repo.get<EntriCache>(kunciCache(endpoint, params), this.now());
    return entri ?? null;
  }

  async tulis(
    endpoint: string,
    params: Record<string, string>,
    status: number,
    body: unknown,
    ttlMs: number | null,
  ): Promise<void> {
    const now = this.now();
    const entri: EntriCache = { endpoint, params, storedAt: now.toISOString(), ttlMs, status, body };
    await this.repo.set({
      key: kunciCache(endpoint, params),
      endpoint,
      payload: entri,
      ttlMs: ttlMs ?? undefined,
      now,
    });
  }

  async kunciBerlaku(): Promise<Set<string>> {
    return this.repo.validKeys(this.now());
  }
}
