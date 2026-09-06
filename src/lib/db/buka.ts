// Pembuka DB untuk skrip (bukan runtime Next): Neon/Postgres bila DATABASE_URL
// terisi; bila kosong dan pemanggil MENYATAKAN eksplisit folder PGlite
// (`--pglite`), pakai PGlite berkas (Postgres asli via WASM, durable di disk)
// dan terapkan migrasi ./drizzle agar skemanya selalu sama dengan produksi.
// PGlite dimuat dinamis agar tidak ikut bundel Next.
import path from "node:path";

import { getDb, hasDb, isNeonUrl, type Db } from "./client";
import * as schema from "./schema";

export type JenisDb = "neon" | "postgres" | "pglite";

export interface DbTerbuka {
  db: Db;
  jenis: JenisDb;
  /** Keterangan aman untuk log (tanpa kredensial). */
  keterangan: string;
  tutup(): Promise<void>;
}

export interface OpsiBukaDb {
  /** Folder PGlite yang dipakai HANYA bila DATABASE_URL kosong. */
  pgliteDir?: string;
  /** Folder migrasi Drizzle (default ./drizzle). */
  migrationsFolder?: string;
}

export const DIR_PGLITE_DEFAULT = ".pglite";

export async function bukaDb(opsi: OpsiBukaDb = {}): Promise<DbTerbuka> {
  if (hasDb()) {
    const url = process.env.DATABASE_URL!.trim();
    const jenis: JenisDb = isNeonUrl(url) ? "neon" : "postgres";
    let host = "?";
    try {
      host = new URL(url).hostname.replace(/^[^.]+/, "<ep>");
    } catch {
      /* biarkan */
    }
    return { db: getDb(), jenis, keterangan: `${jenis} (${host})`, tutup: async () => {} };
  }
  if (!opsi.pgliteDir) {
    throw new Error(
      "DATABASE_URL kosong. Isi .env.local dengan URL Neon, atau jalankan dengan --pglite untuk memakai PGlite lokal (./.pglite).",
    );
  }
  return bukaPglite(opsi.pgliteDir, opsi.migrationsFolder ?? path.resolve(process.cwd(), "drizzle"));
}

export async function bukaPglite(dir: string, migrationsFolder: string): Promise<DbTerbuka> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(dir);
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder });
  return {
    db: db as unknown as Db,
    jenis: "pglite",
    keterangan: `pglite (${path.resolve(dir)})`,
    tutup: () => client.close(),
  };
}
