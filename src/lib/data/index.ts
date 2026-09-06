// Lapisan data Alarm Saham: satu antarmuka `DataProvider`, dua implementasi.
// Pilih lewat `getProvider()`: Sectors bila SECTORS_API_KEY ada, selain itu fixture.

import { FixtureProvider } from "./fixture-provider";
import type { DataProvider } from "./provider";
import { sectorsProviderDariEnv, type EnvSumber } from "./sectors-provider";

export * from "./types";
export * from "./provider";
export * from "./credits";
export { Ledger, type BarisLedger } from "./ledger";
export { CacheRespons, kunciCache, TTL_SEHARI_MS } from "./cache";
export {
  SectorsProvider,
  sectorsProviderDariEnv,
  SECTORS_BASE_URL,
  DIR_CACHE_DEFAULT,
  type OpsiSectorsProvider,
  type EnvSumber,
} from "./sectors-provider";
export {
  FixtureProvider,
  FIXTURE_BAWAAN,
  type FixtureEmiten,
  type FixtureUniverse,
  type KumpulanFixture,
} from "./fixture-provider";

export const PESAN_TANPA_KUNCI =
  "[alarm-saham] SECTORS_API_KEY tidak ditemukan — memakai FixtureProvider (data contoh, bukan data pasar).";

let terpilih: DataProvider | undefined;
let sudahDiperingatkan = false;

export interface OpsiGetProvider {
  env?: EnvSumber;
  /** Pencatat peringatan; default console.warn. */
  warn?: (pesan: string) => void;
}

/** Provider aktif (memo). Peringatan fixture dicetak sekali per proses. */
export function getProvider(opsi: OpsiGetProvider = {}): DataProvider {
  if (terpilih) return terpilih;
  const env = opsi.env ?? process.env;
  const sectors = sectorsProviderDariEnv(env);
  if (sectors) {
    terpilih = sectors;
    return terpilih;
  }
  if (!sudahDiperingatkan) {
    (opsi.warn ?? console.warn)(PESAN_TANPA_KUNCI);
    sudahDiperingatkan = true;
  }
  terpilih = new FixtureProvider();
  return terpilih;
}

/** Hanya untuk tes: buang memo provider & status peringatan. */
export function resetProvider(): void {
  terpilih = undefined;
  sudahDiperingatkan = false;
}
