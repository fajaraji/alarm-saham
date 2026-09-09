// Bangun database PGlite untuk gerbang e2e jalur DB dari benih yang di-commit
// (tests/e2e/seed/universe-uji.json).
//
//   npm run e2e:seed                 → ./.pglite (dipakai CI)
//   npm run e2e:seed -- --dir=.pglite-e2e
//   npm run e2e:seed -- --paksa      → timpa folder yang sudah ada
//
// PENGAMAN: tanpa `--paksa` skrip MENOLAK menulis ke folder yang sudah ada.
// Di mesin pengembang ./.pglite berisi hasil penarikan 395 kredit Sectors dan
// tidak boleh tertimpa benih; di runner CI foldernya belum ada, jadi jalannya
// mulus. NOL panggilan API Sectors.
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

import { bukaPglite, DIR_PGLITE_DEFAULT } from "../src/lib/db/buka";
import { BERKAS_BENIH_E2E, tanamBenih, type BenihE2E } from "../src/lib/db/benih";

function opsi(nama: string): string | undefined {
  const p = process.argv.slice(2).find((a) => a.startsWith(`--${nama}=`));
  return p?.slice(nama.length + 3);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const paksa = argv.includes("--paksa");
  const dir = path.resolve(process.cwd(), opsi("dir") ?? DIR_PGLITE_DEFAULT);

  if (existsSync(dir)) {
    if (!paksa) {
      throw new Error(
        `Folder ${dir} sudah ada. Skrip ini MENOLAK menimpanya: di mesin pengembang folder itu berisi hasil penarikan universe (395 kredit Sectors). Pakai --dir=<folder lain>, atau --paksa kalau memang ingin menghapusnya.`,
      );
    }
    rmSync(dir, { recursive: true, force: true });
  }

  const berkas = path.resolve(process.cwd(), BERKAS_BENIH_E2E);
  const benih = JSON.parse(readFileSync(berkas, "utf8")) as BenihE2E;

  const t = await bukaPglite(dir, path.resolve(process.cwd(), "drizzle"));
  try {
    await tanamBenih(t.db, benih);
    console.log(
      `[benih] ${benih.symbols.length} emiten (${benih.suspensions.length} suspensi, ${benih.reportDates.length} kuartal, ` +
        `${benih.filings.length} filing, ${benih.corporateActions.length} aksi korporasi, ${benih.financialsQ.length} keuangan) ` +
        `ditanam ke ${dir} — sumber benih: ${benih.sumber}, diekspor ${benih.dibuat}.`,
    );
  } finally {
    await t.tutup();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
