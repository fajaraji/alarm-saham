// Pembuat DB uji. Urutan pilihan:
//   1. Docker tersedia -> kontainer postgres:16 sementara di port acak.
//   2. Tanpa Docker    -> PGlite in-memory (Postgres asli via WASM).
// Keduanya menerapkan migrasi dari ./drizzle sehingga tes membuktikan file
// migrasi yang sama yang dipakai produksi.
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

import { sql } from "drizzle-orm";

import type { Db } from "../../src/lib/db/client";
import * as schema from "../../src/lib/db/schema";

export const MIGRATIONS_FOLDER = path.resolve(process.cwd(), "drizzle");

export type TestDbKind = "docker" | "pglite";

export interface TestDb {
  kind: TestDbKind;
  db: Db;
  /** Terapkan ulang migrasi (harus idempoten). */
  migrate(): Promise<void>;
  /** Jumlah baris di tabel jurnal migrasi drizzle. */
  appliedMigrations(): Promise<number>;
  close(): Promise<void>;
}

export function migrationFileCount(): number {
  return readdirSync(MIGRATIONS_FOLDER).filter((f) => f.endsWith(".sql")).length;
}

function dockerAvailable(): boolean {
  if (process.env.ALARM_TEST_DB === "pglite") return false;
  try {
    execFileSync("docker", ["info"], { stdio: "ignore", timeout: 15_000 });
    return true;
  } catch {
    return false;
  }
}

async function pgliteAvailable(): Promise<boolean> {
  try {
    await import("@electric-sql/pglite");
    return true;
  } catch {
    return false;
  }
}

/** Basis DB uji yang tersedia di mesin ini; null bila tidak ada sama sekali. */
export async function detectTestDbKind(): Promise<TestDbKind | null> {
  if (dockerAvailable()) return "docker";
  if (await pgliteAvailable()) return "pglite";
  return null;
}

async function countMigrations(db: Db): Promise<number> {
  // postgres-js mengembalikan array baris; PGlite mengembalikan { rows }.
  const result: unknown = await db.execute(
    sql`select count(*)::int as n from drizzle.__drizzle_migrations`,
  );
  const rows = (
    Array.isArray(result) ? result : (result as { rows: unknown[] }).rows
  ) as { n: number }[];
  return Number(rows[0]?.n ?? 0);
}

async function makePglite(): Promise<TestDb> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite();
  const db = drizzle({ client, schema });
  const run = () => migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  await run();
  return {
    kind: "pglite",
    db: db as unknown as Db,
    migrate: run,
    appliedMigrations: () => countMigrations(db as unknown as Db),
    close: () => client.close(),
  };
}

async function makeDocker(): Promise<TestDb> {
  const postgres = (await import("postgres")).default;
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");

  const containerId = execFileSync(
    "docker",
    [
      "run",
      "-d",
      "--rm",
      "-e",
      "POSTGRES_PASSWORD=pg",
      "-e",
      "POSTGRES_DB=alarm",
      "-p",
      "127.0.0.1:0:5432",
      "postgres:16",
    ],
    { encoding: "utf8", timeout: 300_000 },
  ).trim();
  const stop = () => {
    try {
      execFileSync("docker", ["rm", "-f", containerId], { stdio: "ignore" });
    } catch {
      /* kontainer sudah hilang */
    }
  };

  try {
    const mapping = execFileSync("docker", ["port", containerId, "5432/tcp"], {
      encoding: "utf8",
    });
    const port = Number(mapping.trim().split("\n")[0].split(":").pop());
    // Kredensial lewat opsi, bukan di URL, agar pemindai rahasia pre-commit
    // (pola user:pass@host) tidak terpicu oleh sandi dummy kontainer uji.
    const client = postgres(`postgres://127.0.0.1:${port}/alarm`, {
      username: "postgres",
      password: "pg",
      max: 1,
      onnotice: () => {},
    });

    // Tunggu server siap (maks ~60 detik).
    const deadline = Date.now() + 60_000;
    for (;;) {
      try {
        await client`select 1`;
        break;
      } catch (err) {
        if (Date.now() > deadline) throw err;
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    const db = drizzle({ client, schema });
    const run = () => migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    await run();
    return {
      kind: "docker",
      db: db as unknown as Db,
      migrate: run,
      appliedMigrations: () => countMigrations(db as unknown as Db),
      close: async () => {
        await client.end({ timeout: 5 });
        stop();
      },
    };
  } catch (err) {
    stop();
    throw err;
  }
}

export async function makeTestDb(kind?: TestDbKind): Promise<TestDb> {
  const chosen = kind ?? (await detectTestDbKind());
  if (chosen === "docker") return makeDocker();
  if (chosen === "pglite") return makePglite();
  throw new Error("Tidak ada basis DB uji: Docker mati dan @electric-sql/pglite tidak ada");
}
