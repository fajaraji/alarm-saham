// Pemuat data satu emiten untuk layar putar ulang (server-side saja).
// Dua jalur: DB (Drizzle; pdf_url suspensi ikut) atau sumber kejadian umum
// (fixture) lewat `muatEmitenDariSumber`.
import { asc, eq } from "drizzle-orm";

import type { Db } from "../db/client";
import { suspensions, symbols } from "../db/schema";
import { hariIni, pastikanTanggal } from "../engine/dates";
import { fromDb, kosong, type EmitenEvents, type Group, type UniverseEntry } from "../engine/events";
import type { SumberKejadian } from "../engine/sumber";
import { turunkanKejadian, type Kejadian } from "./kejadian";

export type StatusEmiten =
  /** Ada di universe uji dan punya data laporan. */
  | "lengkap"
  /** Ada di universe uji, tetapi endpoint `dates` mengembalikan 404 (docs/universe-pull.md). */
  | "laporan_tidak_tersedia"
  /** Tidak di universe uji; hanya muncul di feed suspensi seluruh bursa. */
  | "hanya_suspensi"
  /** Tidak ada satu pun baris di data kami. */
  | "tidak_ada";

export interface EmitenPutarUlang {
  symbol: string;
  status: StatusEmiten;
  companyName: string | null;
  group: Group | null;
  targetEventDate: string | null;
  today: string;
  events: EmitenEvents;
  kejadian: Kejadian[];
  /** Catatan jujur tentang keterbatasan data emiten ini. */
  catatan: string[];
}

/** 8 emiten yang endpoint `dates` Sectors-nya 404 saat tiket 07 (docs/universe-pull.md). */
export const EMITEN_DATES_404 = ["COWL", "SUGI", "MABA", "SKYB", "KBRI", "NUSA", "RIMO", "SIMA"] as const;

const POLA_KODE = /^[A-Z]{2,5}$/;

/** Normalisasi kode saham dari input pengguna; null bila bukan 2–5 huruf. */
export function normalKode(masukan: string | null | undefined): string | null {
  const s = (masukan ?? "").trim().toUpperCase().replace(/\.JK$/, "");
  return POLA_KODE.test(s) ? s : null;
}

interface BahanEmiten {
  symbol: string;
  today: string;
  /** Baris universe (null bila tidak ada di tabel `symbols`/fixture universe). */
  baris: { companyName: string | null; group: Group; targetEventDate: string | null } | null;
  pdfUrl: Record<string, string | null>;
  events: EmitenEvents;
}

function kodeTidakSah(masukan: string, today: string): EmitenPutarUlang {
  return {
    symbol: (masukan ?? "").trim().toUpperCase(),
    status: "tidak_ada",
    companyName: null,
    group: null,
    targetEventDate: null,
    today,
    events: kosong(""),
    kejadian: [],
    catatan: ["Kode saham harus 2–5 huruf, mis. SRIL."],
  };
}

/** Susun hasil akhir dari bahan mentah (murni; dipakai kedua jalur). */
export function susunEmiten(b: BahanEmiten): EmitenPutarUlang {
  const { symbol, today, baris, events } = b;
  const kejadian = turunkanKejadian({ events, pdfUrl: b.pdfUrl, today });
  const diUniverse = baris !== null;
  const adaData =
    events.suspensions.length +
      events.quarters.length +
      events.rightIssues.length +
      events.financials.length +
      events.filings.length >
    0;

  const catatan: string[] = [];
  let status: StatusEmiten;
  if (diUniverse && events.quarters.length > 0) {
    status = "lengkap";
  } else if (diUniverse) {
    status = "laporan_tidak_tersedia";
    const diketahui404 = (EMITEN_DATES_404 as readonly string[]).includes(symbol);
    catatan.push(
      `Data laporan keuangan ${symbol} tidak tersedia di sumber: endpoint Sectors get_quarterly_financial_dates ${
        diketahui404 ? "mengembalikan 404 saat penarikan tiket 07" : "tidak memberi satu pun kuartal"
      }. Yang bisa ditampilkan hanya data suspensi dari feed BEI.`,
    );
  } else if (adaData) {
    status = "hanya_suspensi";
    catatan.push(
      `${symbol} tidak termasuk 107 emiten universe uji, tetapi muncul di feed suspensi seluruh bursa (2018–2026). Data laporan, aksi korporasi, keuangan, dan filing tidak kami tarik untuk emiten ini.`,
    );
  } else {
    status = "tidak_ada";
  }
  if (status !== "tidak_ada" && events.filings.length === 0) {
    catatan.push("Tidak ada filing orang dalam untuk emiten ini di feed Sectors (feed filing baru dimulai 2024).");
  }
  if (status === "lengkap" && events.financials.length === 0) {
    catatan.push(
      "Angka keuangan kuartalan (ekuitas) tidak ditarik untuk emiten ini — hemat kredit; blok ekuitas negatif tidak bisa dinilai.",
    );
  }

  return {
    symbol,
    status,
    companyName: baris?.companyName ?? null,
    group: baris?.group ?? null,
    targetEventDate: baris?.targetEventDate ?? null,
    today,
    events,
    kejadian,
    catatan,
  };
}

/** Jalur DB: tabel symbols + suspensions (pdf_url) + fromDb(db).events. */
export async function muatEmiten(db: Db, symbolMasukan: string, today: string = hariIni()): Promise<EmitenPutarUlang> {
  const t = pastikanTanggal("today", today);
  const symbol = normalKode(symbolMasukan);
  if (!symbol) return kodeTidakSah(symbolMasukan, t);

  const [baris, susp, events] = await Promise.all([
    db
      .select({
        companyName: symbols.companyName,
        group: symbols.group,
        targetEventDate: symbols.targetEventDate,
      })
      .from(symbols)
      .where(eq(symbols.symbol, symbol))
      .limit(1),
    db
      .select({ date: suspensions.suspensionDate, pdfUrl: suspensions.pdfUrl })
      .from(suspensions)
      .where(eq(suspensions.symbol, symbol))
      .orderBy(asc(suspensions.suspensionDate)),
    fromDb(db).events(symbol),
  ]);

  return susunEmiten({
    symbol,
    today: t,
    baris: baris[0] ?? null,
    pdfUrl: Object.fromEntries(susp.map((s) => [s.date, s.pdfUrl ?? null])),
    events,
  });
}

/** Jalur umum: DB bila ada, selain itu sumber kejadian + universe (fixture; tanpa pdf_url). */
export async function muatEmitenDariSumber(
  sumber: Pick<SumberKejadian, "db" | "source" | "universe">,
  symbolMasukan: string,
  today: string = hariIni(),
): Promise<EmitenPutarUlang> {
  if (sumber.db) return muatEmiten(sumber.db, symbolMasukan, today);
  const t = pastikanTanggal("today", today);
  const symbol = normalKode(symbolMasukan);
  if (!symbol) return kodeTidakSah(symbolMasukan, t);
  const [events, universe] = await Promise.all([sumber.source.events(symbol), sumber.universe()]);
  const u: UniverseEntry | undefined = universe.find((x) => x.symbol === symbol);
  return susunEmiten({
    symbol,
    today: t,
    baris: u ? { companyName: null, group: u.group, targetEventDate: u.targetEventDate ?? null } : null,
    pdfUrl: {},
    events,
  });
}
