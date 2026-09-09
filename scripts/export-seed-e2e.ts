// Ekspor data kelas A dari database ke berkas benih e2e yang DI-COMMIT
// (tests/e2e/seed/universe-uji.json).
//
// Kenapa ada: gerbang e2e CI dulu hanya menjalankan jalur data contoh, karena
// runner tidak punya ./.pglite (57 MB, di-gitignore). Akibatnya bentuk yang
// dideploy — jalur database — justru satu-satunya yang tidak pernah diuji mesin.
// Benih ini kecil (< 1 MB) dan berisi baris NYATA hasil penarikan Sectors tiket
// 07, sehingga `npm run e2e:seed` bisa membangun ./.pglite di runner dan spec
// jalur DB (nama perusahaan, tautan PDF BEI, COWL, portofolio tersimpan di
// server) berjalan apa adanya.
//
//   npm run e2e:export-seed -- --pglite
//
// NOL panggilan API Sectors: hanya membaca tabel yang sudah ada. Kolom `payload`
// mentah TIDAK ikut kecuali rasio rights issue — satu-satunya bagian payload
// yang dibaca mesin (src/lib/engine/events.ts) — supaya berkasnya tetap ringkas
// dan bisa ditinjau manusia.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { asc } from "drizzle-orm";

import { bukaDb, DIR_PGLITE_DEFAULT } from "../src/lib/db/buka";
import {
  corporateActions,
  filings,
  financialsQ,
  reportDates,
  suspensions,
  symbols,
} from "../src/lib/db/schema";
import { BERKAS_BENIH_E2E, type BenihE2E } from "../src/lib/db/benih";

function angka(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

async function main(): Promise<void> {
  const pglite = process.argv.slice(2).includes("--pglite");
  const t = await bukaDb(pglite ? { pgliteDir: DIR_PGLITE_DEFAULT } : {});
  try {
    const barisSymbols = await t.db.select().from(symbols).orderBy(asc(symbols.symbol));
    const barisSuspensi = await t.db
      .select({
        symbol: suspensions.symbol,
        suspensionDate: suspensions.suspensionDate,
        reason: suspensions.reason,
        pdfUrl: suspensions.pdfUrl,
      })
      .from(suspensions)
      .orderBy(asc(suspensions.symbol), asc(suspensions.suspensionDate));
    const barisKuartal = await t.db
      .select({
        symbol: reportDates.symbol,
        reportDate: reportDates.reportDate,
        quarter: reportDates.quarter,
        fiscalYear: reportDates.fiscalYear,
      })
      .from(reportDates)
      .orderBy(asc(reportDates.symbol), asc(reportDates.reportDate));
    const barisFiling = await t.db
      .select({
        symbol: filings.symbol,
        timestamp: filings.timestamp,
        holderType: filings.holderType,
        transactionType: filings.transactionType,
        sharePctBefore: filings.sharePctBefore,
        sharePctAfter: filings.sharePctAfter,
      })
      .from(filings)
      .orderBy(asc(filings.symbol), asc(filings.timestamp));
    const barisAksi = await t.db
      .select({
        symbol: corporateActions.symbol,
        kind: corporateActions.kind,
        eventDate: corporateActions.eventDate,
        payload: corporateActions.payload,
      })
      .from(corporateActions)
      .orderBy(asc(corporateActions.symbol), asc(corporateActions.eventDate));
    const barisKeuangan = await t.db
      .select({
        symbol: financialsQ.symbol,
        reportDate: financialsQ.reportDate,
        totalEquity: financialsQ.totalEquity,
      })
      .from(financialsQ)
      .orderBy(asc(financialsQ.symbol), asc(financialsQ.reportDate));

    const benih: BenihE2E = {
      sumber: `ekspor kelas A dari ${t.keterangan.replace(/\(.*\)/, "").trim()} (data nyata Sectors, tiket 07)`,
      dibuat: new Date().toISOString().slice(0, 10),
      symbols: barisSymbols.map((r) => ({
        symbol: r.symbol,
        companyName: r.companyName,
        subSector: r.subSector,
        group: r.group,
        targetEventDate: r.targetEventDate,
        notes: r.notes,
      })),
      suspensions: barisSuspensi.map((r) => ({
        symbol: r.symbol,
        suspensionDate: r.suspensionDate,
        reason: r.reason,
        pdfUrl: r.pdfUrl,
      })),
      reportDates: barisKuartal,
      filings: barisFiling.map((r) => ({
        symbol: r.symbol,
        timestamp: r.timestamp.toISOString(),
        holderType: r.holderType,
        transactionType: r.transactionType,
        sharePctBefore: r.sharePctBefore,
        sharePctAfter: r.sharePctAfter,
      })),
      corporateActions: barisAksi.map((r) => ({
        symbol: r.symbol,
        kind: r.kind,
        eventDate: r.eventDate,
        // Hanya rasio rights issue yang dibaca mesin; sisanya dibuang.
        newRatio: angka(r.payload?.new_ratio),
        oldRatio: angka(r.payload?.old_ratio),
      })),
      financialsQ: barisKeuangan,
    };

    const tujuan = path.resolve(process.cwd(), BERKAS_BENIH_E2E);
    mkdirSync(path.dirname(tujuan), { recursive: true });
    writeFileSync(tujuan, `${JSON.stringify(benih)}\n`, "utf8");
    console.log(
      `[benih] ${benih.symbols.length} emiten, ${benih.suspensions.length} suspensi, ` +
        `${benih.reportDates.length} kuartal, ${benih.filings.length} filing, ` +
        `${benih.corporateActions.length} aksi korporasi, ${benih.financialsQ.length} keuangan → ${tujuan}`,
    );
  } finally {
    await t.tutup();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
