// Klien database: satu tipe `Db` untuk semua driver (Neon HTTP, Postgres
// biasa, PGlite di tes) agar repository bisa disuntik DB apa pun.
//
// Koneksi dibuat malas (lazy) — JANGAN instansiasi di module scope karena
// `next build` mengimpor modul route saat DATABASE_URL mungkin kosong.
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let cached: Db | null = null;
let cachedUrl: string | null = null;

/** Apakah DATABASE_URL terisi (fallback file/in-memory dipakai bila tidak). */
export function hasDb(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/** Host Neon dilayani lewat HTTP driver (cocok serverless, tanpa pool). */
export function isNeonUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return /(^|\.)neon\.tech$/i.test(host);
  } catch {
    return false;
  }
}

/**
 * Kembalikan instance Drizzle untuk DATABASE_URL. Dilempar bila kosong —
 * pemanggil wajib mengecek `hasDb()` lebih dulu.
 *
 * `urlEksplisit` dipakai pemanggil yang membaca env dari objek suntikan (mis.
 * `sectorsProviderDariEnv(envBuatan)`); tanpa itu pemeriksaan dan koneksi
 * membaca sumber yang berbeda dan pesan galatnya menyesatkan.
 */
export function getDb(urlEksplisit?: string): Db {
  const url = urlEksplisit?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL belum diset; gunakan hasDb() sebelum getDb()");
  }
  if (cached && cachedUrl === url) return cached;
  cached = isNeonUrl(url)
    ? (drizzleNeon({ client: neon(url), schema }) as unknown as Db)
    : // Serverless: 1 koneksi; prepare=false aman di belakang pooler (PgBouncer).
      (drizzlePostgres({
        client: postgres(url, { max: 1, prepare: false }),
        schema,
      }) as unknown as Db);
  cachedUrl = url;
  return cached;
}

/** Hanya untuk tes: buang instance yang di-cache. */
export function resetDbCache(): void {
  cached = null;
  cachedUrl = null;
}

export { schema };
