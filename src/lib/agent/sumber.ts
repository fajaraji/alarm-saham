// Pemilih sumber kejadian + universe untuk agent: DB bila DATABASE_URL ada,
// selain itu fixture universe-kecil.json (nol panggilan API).
import { getDb, hasDb } from "../db";
import { fromDb, fromFixture, universeFromDb, type EventSource, type UniverseEntry } from "../engine";
import universeKecil from "../engine/fixtures/universe-kecil.json";

export interface SumberTerpilih {
  source: EventSource;
  universe: UniverseEntry[];
  keterangan: string;
}

export async function pilihSumber(paksaFixture = false): Promise<SumberTerpilih> {
  if (!paksaFixture && hasDb()) {
    const db = getDb();
    return { source: fromDb(db), universe: await universeFromDb(db), keterangan: "DB (DATABASE_URL)" };
  }
  const fx = fromFixture(universeKecil);
  return {
    source: fx,
    universe: fx.universe,
    keterangan: paksaFixture
      ? "fixture universe-kecil.json (dipaksa)"
      : "fixture universe-kecil.json (DATABASE_URL tidak diset)",
  };
}
