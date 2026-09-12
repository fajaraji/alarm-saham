// Snapshot buku kredit Sectors: baca tabel `api_ledger` lalu tulis
// docs/kredit-ledger.json.
//
// Satu sumber kebenaran untuk angka kredit. Sebelum tiket 15 angkanya diketik
// ulang di dua tempat (halaman /cara-kami-menghitung dan README) dan sempat
// berbeda 4 kredit untuk tanggal yang sama. Sekarang keduanya turun dari berkas
// ini, dan tests/unit/docs/kredit-ledger.test.ts menolak kalau salah satunya
// menyimpang atau kalau berkas ini beda dengan isi api_ledger.
//
//   npm run kredit:snapshot -- --pglite        (DATABASE_URL kosong → ./.pglite)
//   npm run kredit:snapshot                    (pakai DATABASE_URL bila ada)
//
// NOL panggilan API Sectors: hanya membaca tabel yang sudah ada.
import { writeFileSync } from "node:fs";
import path from "node:path";

import { desc, sql } from "drizzle-orm";

import { bukaDb, DIR_PGLITE_DEFAULT } from "../src/lib/db/buka";
import { apiLedger } from "../src/lib/db/schema";
import { BERKAS_KREDIT_LEDGER, type KreditLedger } from "../src/lib/metodologi/kredit";

/** "/v2/company/corporate-actions/SRIL/" → "/v2/company/corporate-actions/{symbol}/". */
function keluarga(endpoint: string): string {
  return endpoint
    .split("/")
    .map((s) => (/^[A-Z][A-Z0-9]{1,5}$/.test(s) ? "{symbol}" : s))
    .join("/");
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const pglite = argv.includes("--pglite");
  const t = await bukaDb(pglite ? { pgliteDir: DIR_PGLITE_DEFAULT } : {});
  try {
    const [ringkas] = await t.db
      .select({
        baris: sql<number>`count(*)::int`,
        total: sql<number>`coalesce(sum(${apiLedger.credits}), 0)::int`,
        panggilan: sql<number>`coalesce(sum(case when ${apiLedger.cacheHit} = 0 then 1 else 0 end), 0)::int`,
        cacheHit: sql<number>`coalesce(sum(${apiLedger.cacheHit}), 0)::int`,
      })
      .from(apiLedger);

    const mentahEndpoint = await t.db
      .select({
        endpoint: apiLedger.endpoint,
        baris: sql<number>`count(*)::int`,
        kredit: sql<number>`coalesce(sum(${apiLedger.credits}), 0)::int`,
      })
      .from(apiLedger)
      .groupBy(apiLedger.endpoint);

    // Endpoint per-emiten (…/SRIL/) digabung menjadi satu baris {symbol} agar
    // snapshot terbaca manusia; totalnya tetap sama dengan sum(credits).
    const gabung = new Map<string, { baris: number; kredit: number }>();
    for (const r of mentahEndpoint) {
      const kunci = keluarga(r.endpoint);
      const a = gabung.get(kunci) ?? { baris: 0, kredit: 0 };
      gabung.set(kunci, { baris: a.baris + r.baris, kredit: a.kredit + r.kredit });
    }
    const perEndpoint = [...gabung.entries()]
      .map(([endpoint, v]) => ({ endpoint, ...v }))
      .sort((a, b) => b.kredit - a.kredit || a.endpoint.localeCompare(b.endpoint));

    const [terakhir] = await t.db
      .select({ at: apiLedger.at })
      .from(apiLedger)
      .orderBy(desc(apiLedger.at))
      .limit(1);

    const isi: KreditLedger = {
      sumber: `tabel api_ledger (${t.keterangan.replace(/\(.*\)/, "").trim()})`,
      tanggal: (terakhir?.at ?? new Date()).toISOString().slice(0, 10),
      baris: ringkas.baris,
      total: ringkas.total,
      panggilanSungguhan: ringkas.panggilan,
      cacheHit: ringkas.cacheHit,
      perEndpoint: perEndpoint.map((r) => ({ endpoint: r.endpoint, baris: r.baris, kredit: r.kredit })),
    };

    const tujuan = path.resolve(process.cwd(), BERKAS_KREDIT_LEDGER);
    writeFileSync(tujuan, `${JSON.stringify(isi, null, 2)}\n`, "utf8");
    console.log(`[kredit] ${isi.total} kredit dari ${isi.baris} baris api_ledger (${isi.tanggal}) → ${tujuan}`);
  } finally {
    await t.tutup();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
