#!/usr/bin/env node
// Sinkron isi DB antar penyimpan TANPA kredit API (tiket 07 → produksi):
//
//   npm run db:sync                                          = --from=pglite --to=neon
//   npm run db:sync -- --from=pglite --to=neon               PGlite lokal ./.pglite → DATABASE_URL (Neon)
//   npm run db:sync -- --from=neon --to=pglite               salin Neon → PGlite lokal (mis. untuk uji offline)
//   npm run db:sync -- --from=pglite --to=pglite:./.pglite-b uji lokal antar dua folder PGlite
//
// Tabel: symbols, suspensions, report_dates, corporate_actions, filings, financials_q,
// api_ledger, api_cache — upsert idempoten per batch (lihat src/lib/db/sinkron.ts), lalu
// jumlah baris per tabel di sumber vs tujuan dicetak dan HARUS sama (exit 0; beda → exit 2).
// Tujuan Neon harus sudah dimigrasi (`npm run db:migrate`). Tidak mencetak DATABASE_URL.
import path from "node:path";
import { sql } from "drizzle-orm";

import { bukaDb, bukaPglite, type DbTerbuka } from "../src/lib/db/buka";
import { TABEL_SINKRON, sinkronDb, uraiTarget, type TargetDb } from "../src/lib/db/sinkron";

function nilai(argv: string[], nama: string, bawaan: string): string {
  const a = argv.find((x) => x.startsWith(`${nama}=`));
  return a ? a.slice(nama.length + 1) : bawaan;
}

/** Hilangkan nilai DATABASE_URL dari pesan error apa pun (pertahanan berlapis). */
function redaksi(teks: string): string {
  const url = process.env.DATABASE_URL?.trim();
  return url ? teks.split(url).join("[DATABASE_URL]") : teks;
}

async function buka(target: TargetDb, peran: "sumber" | "tujuan"): Promise<DbTerbuka> {
  if (target.jenis === "pglite") {
    return bukaPglite(target.dir!, path.resolve(process.cwd(), "drizzle"));
  }
  // neon = DATABASE_URL; bukaDb melempar bila kosong.
  const terbuka = await bukaDb({});
  try {
    await terbuka.db.execute(sql`select 1`);
  } catch (err) {
    await terbuka.tutup();
    throw new Error(`${peran} Neon tidak bisa dijangkau: ${redaksi(err instanceof Error ? err.message : String(err))}`);
  }
  return terbuka;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  for (const a of argv) {
    if (!a.startsWith("--from=") && !a.startsWith("--to=")) {
      console.error(`Argumen tidak dikenal: ${a} (pakai --from=pglite|pglite:DIR|neon --to=neon|pglite|pglite:DIR)`);
      return 1;
    }
  }
  const dari = uraiTarget(nilai(argv, "--from", "pglite"));
  const ke = uraiTarget(nilai(argv, "--to", "neon"));
  if (dari.jenis === "neon" && ke.jenis === "neon") {
    console.error("Sumber dan tujuan sama-sama DATABASE_URL; tidak ada yang disinkronkan.");
    return 1;
  }
  if (dari.jenis === "pglite" && ke.jenis === "pglite" && path.resolve(dari.dir!) === path.resolve(ke.dir!)) {
    console.error("Sumber dan tujuan PGlite menunjuk folder yang sama.");
    return 1;
  }

  let sumber: DbTerbuka | null = null;
  let tujuan: DbTerbuka | null = null;
  try {
    sumber = await buka(dari, "sumber");
    console.log(`Sumber : ${sumber.keterangan}`);
    tujuan = await buka(ke, "tujuan");
    console.log(`Tujuan : ${tujuan.keterangan}`);
  } catch (err) {
    const pesan = redaksi(err instanceof Error ? err.message : String(err));
    console.error(`GAGAL membuka DB: ${pesan}`);
    if (ke.jenis === "neon" || dari.jenis === "neon") {
      console.error("Isi DATABASE_URL di .env.local (URL Neon), jalankan `npm run db:migrate`, lalu ulangi `npm run db:sync`.");
    }
    await sumber?.tutup();
    return 1;
  }

  try {
    const hasil = await sinkronDb(sumber.db, tujuan.db, { log: (m) => console.log(`  ${m}`) });
    console.log("");
    console.log("Tabel                Sumber  Tujuan  Status");
    for (const t of TABEL_SINKRON) {
      const b = hasil.baris[t];
      console.log(`${t.padEnd(20)} ${String(b.sumber).padStart(6)}  ${String(b.tujuan).padStart(6)}  ${b.sumber === b.tujuan ? "sama" : "BEDA"}`);
    }
    console.log("");
    console.log(
      hasil.sama
        ? "Sinkron selesai: jumlah baris semua tabel SAMA di sumber dan tujuan."
        : "Sinkron selesai dengan PERBEDAAN jumlah baris (tujuan memuat baris yang tidak ada di sumber, atau sebaliknya).",
    );
    return hasil.sama ? 0 : 2;
  } finally {
    await sumber.tutup();
    await tujuan.tutup();
  }
}

main().then(
  (kode) => process.exit(kode),
  (err) => {
    console.error(`GAGAL: ${redaksi(err instanceof Error ? err.message : String(err))}`);
    process.exit(3);
  },
);
