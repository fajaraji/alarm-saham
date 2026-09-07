#!/usr/bin/env node
// CLI uji-ke-masa-lalu:
//   npm run backtest -- <aturan.json> [--fixture] [--pglite[=dir]] [--json] [--today=YYYY-MM-DD]
//
// Sumber data (lihat src/lib/engine/sumber.ts): DB (DATABASE_URL) bila ada;
// bila kosong, PGlite lokal ./.pglite bila foldernya ada (atau --pglite[=dir]);
// selain itu fixture src/lib/engine/fixtures/universe-kecil.json. Nol panggilan API.
import { readFileSync } from "node:fs";
import path from "node:path";

import { formatBacktest, parseRule, RuleError, runBacktest } from "../src/lib/engine";
import { getEventSource } from "../src/lib/engine/sumber";

function bantuan(): string {
  return [
    "Pemakaian: npm run backtest -- <aturan.json> [--fixture] [--pglite[=dir]] [--json] [--today=YYYY-MM-DD]",
    "",
    "  <aturan.json>  file aturan alarm, contoh: src/lib/engine/fixtures/aturan-default.json",
    "  --fixture      paksa memakai fixture universe-kecil.json walau DB ada",
    "  --pglite[=dir] pakai PGlite lokal (default ./.pglite; otomatis bila folder ada dan DATABASE_URL kosong)",
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

  const sumber = await getEventSource({
    fixture: Boolean(arg.opsi.fixture),
    pglite: arg.opsi.pglite === undefined ? undefined : arg.opsi.pglite === "1" ? true : arg.opsi.pglite,
  });
  try {
    const semua = await sumber.universe();
    // Emiten kena TANPA target_event_date (docs/universe-pull.md catatan 4: MENN,
    // TGRA, WSKT) tidak punya "kejadian target" untuk diukur lead-nya; mesin
    // menolaknya, jadi dilewati di sini dan dicatat agar jumlahnya jujur.
    const tanpaTarget = semua.filter((u) => u.group !== "control" && !u.targetEventDate);
    const universe = semua.filter((u) => !tanpaTarget.includes(u));
    if (universe.length === 0) {
      console.error(`Universe kosong dari ${sumber.keterangan}; tidak ada yang bisa diuji.`);
      return 1;
    }
    const hasil = await runBacktest(rule, universe, sumber.source, { today: arg.opsi.today });

    if (arg.opsi.json) {
      console.log(JSON.stringify({ ...hasil, skippedNoTarget: tanpaTarget.map((u) => u.symbol) }, null, 2));
    } else {
      console.log(`Sumber   : ${sumber.keterangan}`);
      if (tanpaTarget.length) {
        console.log(
          `Dilewati : ${tanpaTarget.length} emiten kena tanpa target_event_date (${tanpaTarget
            .map((u) => u.symbol)
            .join(", ")}) — tidak ada kejadian target untuk diukur`,
        );
      }
      console.log(formatBacktest(rule, hasil));
    }
    return 0;
  } finally {
    await sumber.tutup();
  }
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
