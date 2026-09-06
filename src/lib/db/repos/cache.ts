// Cache respons API Sectors di DB (pengganti `.cache/sectors/` berbasis file).
// Kunci dibuat pemanggil (mis. hash endpoint+params). `expiresAt` NULL berarti
// permanen — data historis tidak berubah, jadi tidak perlu diambil ulang.
import { eq } from "drizzle-orm";

import type { Db } from "../client";
import { apiCache } from "../schema";

export interface CacheSetInput {
  key: string;
  endpoint: string;
  payload: unknown;
  /** Umur cache dalam milidetik; tidak diisi = permanen. */
  ttlMs?: number;
  now?: Date;
}

export function createCacheRepo(db: Db) {
  return {
    /** Kembalikan payload bila ada dan belum kedaluwarsa; selain itu null. */
    async get<T = unknown>(key: string, now: Date = new Date()): Promise<T | null> {
      const [row] = await db
        .select({ payload: apiCache.payload, expiresAt: apiCache.expiresAt })
        .from(apiCache)
        .where(eq(apiCache.key, key))
        .limit(1);
      if (!row) return null;
      if (row.expiresAt && row.expiresAt.getTime() <= now.getTime()) return null;
      return row.payload as T;
    },

    /** Upsert: kunci yang sama ditimpa dengan payload & waktu baru. */
    async set(input: CacheSetInput): Promise<void> {
      const now = input.now ?? new Date();
      const expiresAt =
        input.ttlMs === undefined ? null : new Date(now.getTime() + input.ttlMs);
      await db
        .insert(apiCache)
        .values({
          key: input.key,
          endpoint: input.endpoint,
          payload: input.payload,
          fetchedAt: now,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: apiCache.key,
          set: {
            endpoint: input.endpoint,
            payload: input.payload,
            fetchedAt: now,
            expiresAt,
          },
        });
    },

    async delete(key: string): Promise<void> {
      await db.delete(apiCache).where(eq(apiCache.key, key));
    },
  };
}

export type CacheRepo = ReturnType<typeof createCacheRepo>;
