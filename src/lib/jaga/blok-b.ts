// Blok kelas B (hanya mode pasang; docs/data-proof.md §3): definisi terukur dan
// evaluator MURNI di atas data terkini Sectors. Pengambilan datanya (dan
// kreditnya) ada di evaluasi.ts; di sini tidak ada I/O sehingga mudah diuji.
//
// - ritel_dominan   : broker-summary 14 hari + registry cohort /v2/brokers/.
//                     Terpenuhi bila >= 70% nilai beli berasal dari broker cohort
//                     "retail" DAN broker asing/institusi net melepas (Σ nval < 0).
// - free_float_kecil: /v2/free-float/ (desimal; 0.12 = 12%). Terpenuhi bila < 15%.
// - jatuh_dari_puncak: /v2/daily/ 90 hari. Terpenuhi bila close terakhir <= 70%
//                     dari close tertinggi 90 hari (pengganti "baru IPO & jatuh",
//                     karena listing-performance 404 untuk hampir semua emiten).
import type { Broker, BrokerSummary, DailyBar, FreeFloatEntry } from "../data/types";
import { tambahHari } from "../engine/dates";

export const BLOK_B_KINDS = ["ritel_dominan", "free_float_kecil", "jatuh_dari_puncak"] as const;
export type BlokBKind = (typeof BLOK_B_KINDS)[number];

export function isBlokBKind(x: unknown): x is BlokBKind {
  return typeof x === "string" && (BLOK_B_KINDS as readonly string[]).includes(x);
}

export const LABEL_BLOK_B: Record<BlokBKind, string> = {
  ritel_dominan: "Ritel dominan, institusi melepas",
  free_float_kecil: "Free float kecil",
  jatuh_dari_puncak: "Jatuh dari puncak 90 hari",
};

/** Penjelasan awam (tooltip kamus). */
export const PENJELASAN_BLOK_B: Record<BlokBKind, string> = {
  ritel_dominan:
    "Mayoritas pembeli 14 hari terakhir adalah broker ritel (orang biasa), sementara broker asing/institusi lebih banyak melepas. Sering terjadi saat harga “digoreng”.",
  free_float_kecil:
    "Porsi saham yang benar-benar beredar di publik kecil (< 15%), sehingga harganya mudah digerakkan segelintir pihak.",
  jatuh_dari_puncak:
    "Harga penutupan terakhir sudah turun 30% atau lebih dari harga tertinggi 90 hari terakhir.",
};

/** Endpoint Sectors yang menjadi sumber tiap blok (untuk teks penjelasan). */
export const SUMBER_BLOK_B: Record<BlokBKind, string> = {
  ritel_dominan: "Sectors /v2/broker-summary/ (14 hari) + /v2/brokers/ (cohort)",
  free_float_kecil: "Sectors /v2/free-float/ (snapshot, cache 24 jam)",
  jatuh_dari_puncak: "Sectors /v2/daily/ (90 hari)",
};

export const AMBANG_B = {
  /** Porsi minimum nilai beli dari broker cohort retail. */
  ritelPorsi: 0.7,
  /** Free float di bawah ini dianggap kecil. */
  freeFloat: 0.15,
  /** close terakhir / close tertinggi 90 hari <= rasio ini = jatuh dari puncak. */
  jatuhRasio: 0.7,
} as const;

export const JENDELA_B = { brokerHari: 14, dailyHari: 90 } as const;

export interface HasilBlokB {
  kind: BlokBKind;
  terpenuhi: boolean;
  /** Kalimat faktual (angka + rentang tanggal), tanpa penilaian. */
  detail: string;
  /** Tanggal data terakhir yang dipakai (YYYY-MM-DD) bila ada. */
  tanggal: string | null;
  sumber: string;
}

export interface JendelaKelasB {
  brokerStart: string;
  brokerEnd: string;
  dailyStart: string;
  dailyEnd: string;
}

/**
 * Jendela pengambilan data terkini. `end` = sehari sebelum `today` (UTC) agar
 * kunci cache stabil sepanjang hari DAN rentangnya sudah historis (provider
 * meng-cache permanen bila end < hari ini). Rentang inklusif: 14 hari = end-13.
 */
export function jendelaKelasB(today: string): JendelaKelasB {
  const end = tambahHari(today, -1);
  return {
    brokerStart: tambahHari(end, -(JENDELA_B.brokerHari - 1)),
    brokerEnd: end,
    dailyStart: tambahHari(end, -(JENDELA_B.dailyHari - 1)),
    dailyEnd: end,
  };
}

export interface InfoCohort {
  cohort: string;
  asing: boolean;
}

/** Peta kode broker → cohort/asing dari registry. Cohort null → "unknown". */
export function petaCohort(brokers: Broker[]): Map<string, InfoCohort> {
  const peta = new Map<string, InfoCohort>();
  for (const b of brokers) {
    peta.set(b.code.trim().toUpperCase(), {
      cohort: (b.cohort ?? "unknown").toLowerCase(),
      asing: b.is_foreign === true,
    });
  }
  return peta;
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function fmtRp(x: number): string {
  const abs = Math.abs(x);
  const tanda = x < 0 ? "-" : "";
  if (abs >= 1e12) return `${tanda}Rp ${(abs / 1e12).toFixed(2)} T`;
  if (abs >= 1e9) return `${tanda}Rp ${(abs / 1e9).toFixed(1)} M`;
  if (abs >= 1e6) return `${tanda}Rp ${(abs / 1e6).toFixed(1)} jt`;
  return `${tanda}Rp ${Math.round(abs).toLocaleString("id-ID")}`;
}

/** Blok 1: ritel dominan & asing/institusi net melepas. */
export function nilaiRitelDominan(ringkas: BrokerSummary, cohort: Map<string, InfoCohort>): HasilBlokB {
  const kind = "ritel_dominan" as const;
  const sumber = SUMBER_BLOK_B[kind];
  const hari = ringkas.data.filter((h) => h.summary.length > 0);
  if (hari.length === 0) {
    return {
      kind,
      terpenuhi: false,
      detail: `tidak ada transaksi broker pada ${ringkas.start ?? "?"}–${ringkas.end ?? "?"} (kemungkinan saham tidak diperdagangkan)`,
      tanggal: null,
      sumber,
    };
  }
  let totalBeli = 0;
  let ritelBeli = 0;
  let netAsingInstitusi = 0;
  let dikenal = 0;
  let total = 0;
  for (const h of hari) {
    for (const r of h.summary) {
      const bval = r.bval ?? 0;
      const nval = r.nval ?? 0;
      const info = cohort.get(r.broker_code.trim().toUpperCase());
      total += 1;
      if (info) dikenal += 1;
      totalBeli += bval;
      if (info?.cohort === "retail") ritelBeli += bval;
      if (info && (info.asing || info.cohort === "institutional")) netAsingInstitusi += nval;
    }
  }
  const tanggal = hari[hari.length - 1].date;
  const rentang = `${hari[0].date}–${tanggal} (${hari.length} hari bursa)`;
  if (dikenal === 0) {
    return { kind, terpenuhi: false, detail: `cohort broker tidak dikenal di registry untuk ${rentang}`, tanggal, sumber };
  }
  if (totalBeli <= 0) {
    return { kind, terpenuhi: false, detail: `nilai pembelian nol pada ${rentang}`, tanggal, sumber };
  }
  const porsi = ritelBeli / totalBeli;
  const terpenuhi = porsi >= AMBANG_B.ritelPorsi && netAsingInstitusi < 0;
  const arah = netAsingInstitusi < 0 ? "net melepas" : "net menambah";
  return {
    kind,
    terpenuhi,
    detail: `broker ritel ${pct(porsi)} dari nilai pembelian ${rentang}; broker asing/institusi ${arah} ${fmtRp(netAsingInstitusi)} (ambang: ritel >= ${pct(AMBANG_B.ritelPorsi)} dan asing/institusi net melepas; ${dikenal}/${total} baris broker dikenal registry)`,
    tanggal,
    sumber,
  };
}

/** Blok 2: free float kecil. `entri` undefined = simbol tidak ada di snapshot. */
export function nilaiFreeFloat(entri: FreeFloatEntry | undefined, tanggalSnapshot: string | null): HasilBlokB {
  const kind = "free_float_kecil" as const;
  const sumber = SUMBER_BLOK_B[kind];
  if (!entri || entri.free_float == null) {
    return { kind, terpenuhi: false, detail: "simbol tidak ada di snapshot free float", tanggal: tanggalSnapshot, sumber };
  }
  const ff = entri.free_float;
  return {
    kind,
    terpenuhi: ff < AMBANG_B.freeFloat,
    detail: `free float ${(ff * 100).toFixed(1)}% (ambang < ${pct(AMBANG_B.freeFloat)})`,
    tanggal: tanggalSnapshot,
    sumber,
  };
}

/** Blok 3: jatuh dari puncak 90 hari (memakai close; high bernilai 0 saat tersuspensi). */
export function nilaiJatuhDariPuncak(bars: DailyBar[]): HasilBlokB {
  const kind = "jatuh_dari_puncak" as const;
  const sumber = SUMBER_BLOK_B[kind];
  const valid = bars
    .filter((b) => b.close != null && b.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (valid.length === 0) {
    return { kind, terpenuhi: false, detail: "tidak ada harga penutupan dalam 90 hari", tanggal: null, sumber };
  }
  const akhir = valid[valid.length - 1];
  let puncak = valid[0];
  for (const b of valid) if ((b.close as number) > (puncak.close as number)) puncak = b;
  const rasio = (akhir.close as number) / (puncak.close as number);
  return {
    kind,
    terpenuhi: rasio <= AMBANG_B.jatuhRasio,
    detail: `penutupan ${akhir.date} = ${akhir.close} vs tertinggi 90 hari ${puncak.close} (${puncak.date}), turun ${pct(1 - rasio)} (ambang >= ${pct(1 - AMBANG_B.jatuhRasio)})`,
    tanggal: akhir.date,
    sumber,
  };
}
