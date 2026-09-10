// Bentuk berkas benih e2e (tests/e2e/seed/universe-uji.json) dan penanamnya ke
// database.
//
// Benih ini berisi baris NYATA hasil penarikan Sectors tiket 07 — bukan angka
// karangan — hanya kolom kelas A yang benar-benar dibaca mesin, tanpa payload
// mentah. Ia dipakai CI untuk membangun ./.pglite sehingga gerbang e2e jalur
// database (bentuk yang dideploy) benar-benar dijalankan mesin, bukan hanya
// jalur data contoh.
//
// Yang TIDAK ada di benih: buku kredit (api_ledger), cache API, portofolio,
// alarm, kotak masuk — tabel itu memang kosong saat server baru dan diisi oleh
// alur uji sendiri.
import type { Group } from "../engine/events";
import type { Db } from "./client";
import {
  corporateActions,
  filings,
  financialsQ,
  reportDates,
  suspensions,
  symbols,
} from "./schema";

export const BERKAS_BENIH_E2E = "tests/e2e/seed/universe-uji.json";

export interface BenihE2E {
  /** Dari mana benih ini diekspor (jejak, tanpa kredensial). */
  sumber: string;
  /** Tanggal ekspor (YYYY-MM-DD). */
  dibuat: string;
  symbols: {
    symbol: string;
    companyName: string | null;
    subSector: string | null;
    group: Group;
    targetEventDate: string | null;
    notes: string | null;
  }[];
  suspensions: { symbol: string; suspensionDate: string; reason: string | null; pdfUrl: string | null }[];
  reportDates: { symbol: string; reportDate: string; quarter: string; fiscalYear: number }[];
  filings: {
    symbol: string;
    /** ISO 8601 UTC. */
    timestamp: string;
    holderType: string | null;
    transactionType: string | null;
    sharePctBefore: number | null;
    sharePctAfter: number | null;
  }[];
  corporateActions: {
    symbol: string;
    kind: string;
    eventDate: string;
    newRatio: number | null;
    oldRatio: number | null;
  }[];
  financialsQ: { symbol: string; reportDate: string; totalEquity: number | null }[];
}

/** Sisipkan per potongan agar tidak melewati batas parameter satu pernyataan. */
async function sisipkan<T>(baris: T[], ukuran: number, kerja: (potongan: T[]) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < baris.length; i += ukuran) await kerja(baris.slice(i, i + ukuran));
}

/** Tanam benih ke database kosong (skema sudah termigrasi). */
export async function tanamBenih(db: Db, benih: BenihE2E): Promise<void> {
  await sisipkan(benih.symbols, 200, (p) => db.insert(symbols).values(p));
  await sisipkan(benih.suspensions, 200, (p) => db.insert(suspensions).values(p));
  await sisipkan(benih.reportDates, 200, (p) => db.insert(reportDates).values(p));
  await sisipkan(benih.filings, 200, (p) =>
    db.insert(filings).values(p.map((f) => ({ ...f, timestamp: new Date(f.timestamp) }))),
  );
  await sisipkan(benih.corporateActions, 200, (p) =>
    db.insert(corporateActions).values(
      p.map((a) => ({
        symbol: a.symbol,
        kind: a.kind as (typeof corporateActions.kind)["_"]["data"],
        eventDate: a.eventDate,
        payload:
          a.newRatio === null && a.oldRatio === null ? {} : { new_ratio: a.newRatio, old_ratio: a.oldRatio },
      })),
    ),
  );
  await sisipkan(benih.financialsQ, 200, (p) => db.insert(financialsQ).values(p));
}
