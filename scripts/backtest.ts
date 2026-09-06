#!/usr/bin/env node
// CLI uji-ke-masa-lalu:
//   npm run backtest -- <aturan.json> [--fixture] [--json] [--today=YYYY-MM-DD]
//
// Sumber data: DB (DATABASE_URL) bila ada dan --fixture tidak diberikan; selain
// itu fixture src/lib/engine/fixtures/universe-kecil.json. Nol panggilan API.
import { readFileSync } from "node:fs";
import path from "node:path";

import { getDb, hasDb } from "../src/lib/db";
import {
  formatBacktest,
  fromDb,
  fromFixture,
  parseRule,
  RuleError,
  runBacktest,
  universeFromDb,
  type EventSource,
  type UniverseEntry,
} from "../src/lib/engine";
import universeKecil from "../src/lib/engine/fixtures/universe-kecil.json";

function bantuan(): string {
  return [
    "Pemakaian: npm run backtest -- <aturan.json> [--fixture] [--json] [--today=YYYY-MM-DD]",
    "",
    "  <aturan.json>  file aturan alarm, contoh: src/lib/engine/fixtures/aturan-default.json",
    "  --fixture      paksa memakai fixture universe-kecil.json walau DATABASE_URL ada",
    "  --json         cetak hasil lengkap sebagai JSON",
    "  --today=...    batas akhir pemindaian kontrol (default: hari ini UTC)",
  ].join("\n");
}

interface Argumen {
  fileAturan?: string;
  opsi: Record<string, string>;
}

function urai(argv: string[]): Argumen {
  const posisi: string[] = [];
  const opsi: Record<string, string> = {};
  for (const a of argv) {
    if (a.startsWith("--")) {
      const [k, ...v] = a.slice(2).split("=");
      opsi[k] = v.length ? v.join("=") : "1";
    } else {
      posisi.push(a);
    }
  }
  return { fileAturan: posisi[0], opsi };
}

async function pilihSumber(
  paksaFixture: boolean,
): Promise<{ source: EventSource; universe: UniverseEntry[]; keterangan: string }> {
  if (!paksaFixture && hasDb()) {
    const db = getDb();
    return {
      source: fromDb(db),
      universe: await universeFromDb(db),
      keterangan: "DB (DATABASE_URL)",
    };
  }
  const fx = fromFixture(universeKecil);
  return {
    source: fx,
    universe: fx.universe,
    keterangan: paksaFixture
      ? "fixture universe-kecil.json (--fixture)"
      : "fixture universe-kecil.json (DATABASE_URL tidak diset)",
  };
}

async function main(): Promise<number> {
  const arg = urai(process.argv.slice(2));
  if (!arg.fileAturan || arg.opsi.help) {
    console.log(bantuan());
    return arg.fileAturan ? 0 : 1;
  }

  const fileAturan = path.resolve(process.cwd(), arg.fileAturan);
  let isi: unknown;
  try {
    isi = JSON.parse(readFileSync(fileAturan, "utf8"));
  } catch (err) {
    console.error(`Gagal membaca ${fileAturan}: ${(err as Error).message}`);
    return 1;
  }
  const rule = parseRule(isi);

  const { source, universe, keterangan } = await pilihSumber(Boolean(arg.opsi.fixture));
  if (universe.length === 0) {
    console.error(`Universe kosong dari ${keterangan}; tidak ada yang bisa diuji.`);
    return 1;
  }
  const hasil = await runBacktest(rule, universe, source, { today: arg.opsi.today });

  if (arg.opsi.json) {
    console.log(JSON.stringify(hasil, null, 2));
  } else {
    console.log(`Sumber   : ${keterangan}`);
    console.log(formatBacktest(rule, hasil));
  }
  return 0;
}

main()
  .then((kode) => process.exit(kode))
  .catch((err: unknown) => {
    if (err instanceof RuleError) {
      console.error(err.message);
    } else {
      console.error(`Gagal: ${err instanceof Error ? err.message : String(err)}`);
    }
    process.exit(1);
  });
