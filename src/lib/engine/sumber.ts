// Pemilih sumber kejadian satu pintu untuk CLI dan halaman aplikasi.
//
// Urutan: DATABASE_URL (Neon/Postgres) → PGlite lokal `./.pglite` bila
// foldernya ada (hasil `npm run pull-universe -- --pglite`, tiket 07) → fixture
// universe-kecil.json. Nol panggilan API Sectors di jalur mana pun.
//
// PGlite berkas hanya boleh dibuka SATU kali per proses (kunci direktori), maka
// instansnya di-cache di globalThis agar hot-reload Next tidak membuka ulang.
import { existsSync } from "node:fs";
import path from "node:path";

import { bukaDb, bukaPglite, DIR_PGLITE_DEFAULT, type DbTerbuka } from "../db/buka";
import type { Db } from "../db/client";
import { hasDb, isNeonUrl } from "../db/client";
import { fromDb, fromFixture, universeFromDb, type EventSource, type UniverseEntry } from "./events";
import universeKecil from "./fixtures/universe-kecil.json";

export type JenisSumber = "neon" | "postgres" | "pglite" | "fixture";

export interface SumberKejadian {
  jenis: JenisSumber;
  /** Keterangan aman untuk log/UI (tanpa kredensial). */
  keterangan: string;
  source: EventSource;
  /** Koneksi Drizzle; null untuk fixture. */
  db: Db | null;
  universe(): Promise<UniverseEntry[]>;
  /** Tutup koneksi (PGlite). Aman dipanggil untuk jenis lain. */
  tutup(): Promise<void>;
}

export interface OpsiSumber {
  /** Paksa fixture walau DB tersedia. */
  fixture?: boolean;
  /** `true` = pakai ./.pglite walau belum ada; string = folder PGlite lain. */
  pglite?: boolean | string;
}

type CachePglite = Map<string, Promise<DbTerbuka>>;
const KUNCI_GLOBAL = "__alarmSahamPglite" as const;

function cachePglite(): CachePglite {
  const g = globalThis as unknown as Record<string, CachePglite | undefined>;
  g[KUNCI_GLOBAL] ??= new Map();
  return g[KUNCI_GLOBAL];
}

async function bukaPgliteSekali(dir: string): Promise<DbTerbuka> {
  const kunci = path.resolve(dir);
  const cache = cachePglite();
  let p = cache.get(kunci);
  if (!p) {
    p = bukaPglite(kunci, path.resolve(process.cwd(), "drizzle")).catch((err) => {
      cache.delete(kunci);
      throw err;
    });
    cache.set(kunci, p);
  }
  const terbuka = await p;
  return {
    ...terbuka,
    tutup: async () => {
      cache.delete(kunci);
      await terbuka.tutup();
    },
  };
}

function dariFixture(alasan: string): SumberKejadian {
  const fx = fromFixture(universeKecil);
  return {
    jenis: "fixture",
    keterangan: `fixture universe-kecil.json (${alasan})`,
    source: fx,
    db: null,
    universe: async () => fx.universe,
    tutup: async () => {},
  };
}

function dariDb(t: DbTerbuka): SumberKejadian {
  return {
    jenis: t.jenis,
    keterangan: t.keterangan,
    source: fromDb(t.db),
    db: t.db,
    universe: () => universeFromDb(t.db),
    tutup: t.tutup,
  };
}

/** Folder PGlite yang akan dipakai bila DATABASE_URL kosong; null bila tidak ada.
 *  `TANPA_PGLITE=1` (dipakai e2e/CI untuk meniru clone bersih, dan oleh
 *  `npm test` untuk membuktikan jalur skip) mengabaikan ./.pglite walau
 *  foldernya ada — kecuali pemanggil menyebut folder eksplisit. */
function folderPglite(opsi: OpsiSumber = {}): string | null {
  if (opsi.pglite === undefined && process.env.TANPA_PGLITE === "1") return null;
  // Folder ditentukan saat runtime (opsi CLI) — jangan ditelusuri Turbopack sebagai aset.
  const absolut =
    typeof opsi.pglite === "string"
      ? path.resolve(/*turbopackIgnore: true*/ process.cwd(), opsi.pglite)
      : path.join(/*turbopackIgnore: true*/ process.cwd(), DIR_PGLITE_DEFAULT);
  if (opsi.pglite === true || typeof opsi.pglite === "string") return absolut;
  return existsSync(absolut) ? absolut : null;
}

export async function getEventSource(opsi: OpsiSumber = {}): Promise<SumberKejadian> {
  if (opsi.fixture) return dariFixture("dipaksa");
  if (hasDb()) return dariDb(await bukaDb());
  const dir = folderPglite(opsi);
  if (dir) return dariDb(await bukaPgliteSekali(dir));
  return dariFixture("DATABASE_URL kosong dan ./.pglite tidak ada");
}

/**
 * Jenis sumber yang AKAN dipilih `getEventSource()`, TANPA membuka koneksi.
 *
 * Dipakai lapisan tampilan (footer disclaimer, overlay panduan, beranda) yang
 * hanya perlu tahu "data nyata atau data contoh" dan tidak boleh membayar biaya
 * membuka PGlite di setiap halaman. Keputusannya harus persis sama dengan
 * getEventSource(); tests/unit/engine/sumber-ringkas.test.ts membandingkan
 * keduanya untuk setiap kombinasi env supaya tidak diam-diam menyimpang.
 */
export function jenisSumberTerpilih(opsi: OpsiSumber = {}): JenisSumber {
  if (opsi.fixture) return "fixture";
  if (hasDb()) return isNeonUrl(process.env.DATABASE_URL!.trim()) ? "neon" : "postgres";
  return folderPglite(opsi) ? "pglite" : "fixture";
}

/** true bila sumbernya database berisi data Sectors nyata (bukan fixture contoh). */
export function sumberNyata(opsi: OpsiSumber = {}): boolean {
  return jenisSumberTerpilih(opsi) !== "fixture";
}
