#!/usr/bin/env node
// Migrasi ledger & cache Sectors ke tabel DB (api_ledger, api_cache). Idempoten.
//
//   npm run cache:migrate-to-db                       berkas .cache/sectors/ → DB (DATABASE_URL)
//   npm run cache:migrate-to-db -- --pglite           berkas → PGlite lokal ./.pglite (DATABASE_URL kosong)
//   npm run cache:migrate-to-db -- --from-pglite      PGlite lokal ./.pglite → DB (DATABASE_URL)  ← pindah ke Neon, 0 kredit
//   opsi: --pglite=DIR  --from-pglite=DIR  --from-dir=FOLDER_CACHE
//
// Tidak memanggil API Sectors dan tidak mencetak rahasia.
import path from "node:path";
import { DIR_CACHE_DEFAULT, migrasiKeDb, sumberDariBerkas, sumberDariDb, type SumberMigrasi } from "../src/lib/data";
import { DIR_PGLITE_DEFAULT, bukaDb, bukaPglite } from "../src/lib/db/buka";

function nilai(argv: string[], nama: string): string | undefined {
  const a = argv.find((x) => x === nama || x.startsWith(`${nama}=`));
  if (!a) return undefined;
  return a.includes("=") ? a.slice(nama.length + 1) : "";
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const pglite = nilai(argv, "--pglite");
  const dariPglite = nilai(argv, "--from-pglite");
  const dariDir = nilai(argv, "--from-dir") || process.env.SECTORS_CACHE_DIR || DIR_CACHE_DEFAULT;

  const tujuan = await bukaDb({ pgliteDir: pglite === undefined ? undefined : pglite || DIR_PGLITE_DEFAULT });
  let sumber: SumberMigrasi;
  let labelSumber: string;
  let tutupSumber = async () => {};
  if (dariPglite !== undefined) {
    const dir = dariPglite || DIR_PGLITE_DEFAULT;
    if (tujuan.jenis === "pglite" && path.resolve(dir) === path.resolve(pglite || DIR_PGLITE_DEFAULT)) {
      console.error("Sumber dan tujuan PGlite sama.");
      return 1;
    }
    const s = await bukaPglite(dir, path.resolve(process.cwd(), "drizzle"));
    sumber = await sumberDariDb(s.db);
    labelSumber = s.keterangan;
    tutupSumber = s.tutup;
  } else {
    sumber = await sumberDariBerkas(dariDir);
    labelSumber = `berkas ${path.resolve(dariDir)}`;
  }

  const hasil = await migrasiKeDb(sumber, tujuan.db);
  console.log(`Sumber : ${labelSumber}`);
  console.log(`Tujuan : ${tujuan.keterangan}`);
  console.log(`Ledger : dibaca ${hasil.ledgerDibaca}, disisipkan ${hasil.ledgerDisisipkan} (kredit ${hasil.kreditDiMigrasi}), dilewati ${hasil.ledgerDilewati}`);
  console.log(`Cache  : dibaca ${hasil.cacheDibaca}, disisipkan ${hasil.cacheDisisipkan}, dilewati ${hasil.cacheDilewati}`);
  await tutupSumber();
  await tujuan.tutup();
  return 0;
}

main().then(
  (kode) => process.exit(kode),
  (err) => {
    console.error(`GAGAL: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(3);
  },
);
