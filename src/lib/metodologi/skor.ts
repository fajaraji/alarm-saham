// Data halaman "Cara kami menghitung" (tiket 14).
//
// Sumber angka skor: docs/skor-nyata.json — keluaran persis
//   npm run backtest -- src/lib/engine/fixtures/aturan-default.json --today=2026-09-07 --json
// di atas PGlite lokal hasil tiket 07 (nol panggilan API). Tes
// tests/unit/docs/skor-nyata.test.ts menghitung ulang dan memastikan angkanya sama.
// Angka kredit: docs/kredit-ledger.json (snapshot langsung dari tabel api_ledger,
// lihat src/lib/metodologi/kredit.ts); rincian langkahnya docs/universe-pull.md
// dan docs/data-proof.md.
import skorMentah from "../../../docs/skor-nyata.json";
import { KREDIT_LEDGER } from "./kredit";
import { BLOCK_KINDS, type BlockKind } from "../engine/rules";
import type { BacktestResult, PerSymbolResult } from "../engine/score";
import type { Group } from "../engine/events";

export interface SkorNyata extends BacktestResult {
  /** Emiten kena tanpa target_event_date yang dilewati CLI (docs/universe-pull.md catatan 4). */
  skippedNoTarget: string[];
}

/** Snapshot skor nyata yang di-commit (tanggal = field `today`). */
export const SKOR_NYATA = skorMentah as unknown as SkorNyata;

/** Perintah yang menghasilkan snapshot (dipakai di halaman & README). */
export const PERINTAH_SNAPSHOT =
  "npm run backtest -- src/lib/engine/fixtures/aturan-default.json --today=2026-09-07 --json";

export interface RingkasanSkor {
  hits: number;
  total: number;
  delisting: { hits: number; total: number; leadAvg: number | null; leadMedian: number | null };
  watchlist: { hits: number; total: number; leadAvg: number | null; leadMedian: number | null };
  leadAvg: number | null;
  leadMedian: number | null;
  falseAlarms: number;
  controls: number;
  skipped: string[];
  /** Emiten kena yang targetnya sebelum leadCutoff (ikut total, tidak ikut lead). */
  excludedFromLead: number;
  /** Jumlah blok yang terpenuhi pada bunyi pertama, per jenis (satu emiten bisa >1 blok). */
  blokPertama: Record<BlockKind, number>;
}

/** Angka ringkasan yang dibandingkan tes dengan hasil hitung ulang. */
export function ringkasSkor(s: SkorNyata): RingkasanSkor {
  const blokPertama = Object.fromEntries(BLOCK_KINDS.map((k) => [k, 0])) as Record<BlockKind, number>;
  for (const r of s.perSymbol) {
    if (r.group === "control" || !r.fired) continue;
    for (const alasan of r.reasons) blokPertama[alasan.kind] += 1;
  }
  return {
    hits: s.hits,
    total: s.total,
    delisting: {
      hits: s.perGroup.delisting.hits,
      total: s.perGroup.delisting.total,
      leadAvg: s.perGroup.delisting.leadMonthsAvg,
      leadMedian: s.perGroup.delisting.leadMonthsMedian,
    },
    watchlist: {
      hits: s.perGroup.watchlist.hits,
      total: s.perGroup.watchlist.total,
      leadAvg: s.perGroup.watchlist.leadMonthsAvg,
      leadMedian: s.perGroup.watchlist.leadMonthsMedian,
    },
    leadAvg: s.leadMonthsAvg,
    leadMedian: s.leadMonthsMedian,
    falseAlarms: s.falseAlarms,
    controls: s.controls,
    skipped: [...s.skippedNoTarget].sort(),
    excludedFromLead: s.perSymbol.filter((r) => r.group !== "control" && r.excludedFromLead).length,
    blokPertama,
  };
}

export function barisKelompok(s: SkorNyata, group: Group): PerSymbolResult[] {
  return s.perGroup[group].perSymbol;
}

// ---------------------------------------------------------------------------
// Kredit Sectors (docs/universe-pull.md §1–§2 catatan manual; docs/data-proof.md §1(3))
// ---------------------------------------------------------------------------

export interface BarisKredit {
  langkah: string;
  kredit: number;
  catatan: string;
}

/** Tiket 03–04: pembuktian data (ledger berkas, lalu dimigrasikan ke DB). */
export const KREDIT_PEMBUKTIAN: BarisKredit[] = [
  {
    langkah: "Pembuktian data 6 emiten × 5 endpoint + probe universe (tiket 04)",
    kredit: 56,
    catatan: "run pertama 53 kredit + 3 probe (broker BBCA, 2 probe kedalaman filings)",
  },
  {
    langkah: "Terbuang: 6 respons 404 dibayar dua kali (5 listing-performance + broker BTEL)",
    kredit: 12,
    catatan: "sebelum cache-404 dan kunci anggaran skrip diperbaiki; dicatat jujur",
  },
];

/** Tiket 07: penarikan universe 107 emiten (angka nyata dari api_ledger). */
export const KREDIT_UNIVERSE: BarisKredit[] = [
  { langkah: "Feed suspensi seluruh bursa (20 halaman × 30)", kredit: 20, catatan: "583 kejadian, 329 emiten, 2018-12-28 – 2026-09-04" },
  { langkah: "Screener LQ45 untuk kontrol", kredit: 1, catatan: "+1 percobaan order_by → HTTP 400 (gratis)" },
  { langkah: "Free float seluruh bursa", kredit: 0, catatan: "masih di cache 24 jam dari tiket 04 (dipakai untuk nama emiten)" },
  { langkah: "Tanggal laporan kuartal (dates) 107 emiten", kredit: 101, catatan: "8 emiten 404 tetap ditagih 1 kredit" },
  { langkah: "Aksi korporasi 99 emiten", kredit: 93, catatan: "8 emiten yang dates-nya 404 sengaja tidak dipanggil" },
  { langkah: "Filing orang dalam 59 pemantauan + 30 kontrol", kredit: 89, catatan: "86 halaman pertama + 3 halaman lanjutan (AKRA, AMMN, BUMI)" },
  { langkah: "Laporan keuangan kuartalan 14 emiten delisting", kredit: 91, catatan: "1 kredit per kuartal; n_quarters dipilih dari dates agar tidak membayar kuartal kosong" },
];

/** Tiket 11: satu uji kelas B nyata di layar Pasang (angka nyata dari api_ledger). */
export const KREDIT_KELAS_B: BarisKredit[] = [
  {
    langkah: "Uji kelas B nyata di layar Pasang (BBCA, ASII) — tiket 11",
    kredit: 4,
    catatan: "broker-summary + daily untuk 2 emiten; ledger 463 → 467",
  },
];

/**
 * Total kredit TIDAK diketik ulang di sini: ia dibaca dari docs/kredit-ledger.json
 * yang dihasilkan `npm run kredit:snapshot -- --pglite` langsung dari tabel
 * api_ledger. Halaman metodologi dan README sama-sama turun dari angka ini, dan
 * tests/unit/docs/kredit-ledger.test.ts menolak kalau salah satunya menyimpang.
 */
export const KREDIT_TOTAL_LEDGER = KREDIT_LEDGER.total;
export const KREDIT_ANGGARAN = 1000;
export const KREDIT_CADANGAN_JURI = 250;
export const KREDIT_TANGGAL_LEDGER = KREDIT_LEDGER.tanggal;

export function totalKredit(baris: BarisKredit[]): number {
  return baris.reduce((a, b) => a + b.kredit, 0);
}
