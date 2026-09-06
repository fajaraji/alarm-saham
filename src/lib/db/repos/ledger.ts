// Buku kredit API Sectors di DB. Menggantikan ledger berbasis file dari
// SectorsProvider (tiket 03) saat DATABASE_URL terisi; penyambungan ke
// provider dilakukan setelah merge.
import { and, count, gte, sql } from "drizzle-orm";

import type { Db } from "../client";
import { apiLedger } from "../schema";

export interface LedgerEntry {
  endpoint: string;
  params?: Record<string, unknown>;
  status: number;
  credits: number;
  cacheHit?: boolean;
  at?: Date;
}

export interface LedgerTotal {
  calls: number;
  credits: number;
}

export function createLedgerRepo(db: Db) {
  return {
    /** Catat satu panggilan API; mengembalikan id baris. */
    async append(entry: LedgerEntry): Promise<number> {
      const [row] = await db
        .insert(apiLedger)
        .values({
          endpoint: entry.endpoint,
          params: entry.params ?? {},
          status: entry.status,
          credits: entry.credits,
          cacheHit: entry.cacheHit ? 1 : 0,
          ...(entry.at ? { at: entry.at } : {}),
        })
        .returning({ id: apiLedger.id });
      return row.id;
    },

    /**
     * Total panggilan & kredit terpakai, opsional sejak waktu tertentu.
     * Panggilan dari cache tetap dihitung sebagai `calls` tetapi credits-nya 0.
     */
    async total(opts: { since?: Date } = {}): Promise<LedgerTotal> {
      const where = opts.since ? and(gte(apiLedger.at, opts.since)) : undefined;
      const [row] = await db
        .select({
          calls: count(),
          credits: sql<number>`coalesce(sum(${apiLedger.credits}), 0)::int`,
        })
        .from(apiLedger)
        .where(where);
      return { calls: Number(row?.calls ?? 0), credits: Number(row?.credits ?? 0) };
    },
  };
}

export type LedgerRepo = ReturnType<typeof createLedgerRepo>;
