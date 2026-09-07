// Universe uji Alarm Saham (docs/data-proof.md §4; catatan riset 7 Sep 2026).
// - 18 emiten delisting efektif 10 Nov 2026 = studi kasus "putar ulang".
// - 59 emiten Papan Pemantauan Khusus per 30 Jun 2026 (Peng-S-00019/BEI.PLP/06-2026)
//   = universe skor utama, bersama 30 kontrol sehat yang dipilih dari data (LQ45
//   tanpa riwayat suspensi 2019–2026; lihat `pilihKontrol`).

export interface EmitenDelisting {
  symbol: string;
  /** Tanggal suspensi awal menurut catatan (sumber publik), YYYY-MM-DD. */
  suspensiCatatan: string;
  alasan: "pailit" | "suspensi>50bln";
  catatan?: string;
}

export const EMITEN_DELISTING: readonly EmitenDelisting[] = [
  { symbol: "COWL", suspensiCatatan: "2020-07-13", alasan: "pailit" },
  { symbol: "MTRA", suspensiCatatan: "2020-11-17", alasan: "pailit" },
  { symbol: "SRIL", suspensiCatatan: "2021-05-18", alasan: "pailit", catatan: "Bareksa menulis 1 Nov 2024; feed & sumber lain: 18 Mei 2021" },
  { symbol: "TOYS", suspensiCatatan: "2024-07-02", alasan: "pailit" },
  { symbol: "SBAT", suspensiCatatan: "2024-09-18", alasan: "pailit" },
  { symbol: "TDPM", suspensiCatatan: "2021-04-27", alasan: "pailit", catatan: "awal gagal bayar MTN" },
  { symbol: "TELE", suspensiCatatan: "2025-06-06", alasan: "pailit", catatan: "kini PT Omni Inovasi Indonesia" },
  { symbol: "LCGP", suspensiCatatan: "2019-05-02", alasan: "suspensi>50bln" },
  { symbol: "SUGI", suspensiCatatan: "2019-07-01", alasan: "suspensi>50bln" },
  { symbol: "MABA", suspensiCatatan: "2020-02-17", alasan: "suspensi>50bln" },
  { symbol: "LMAS", suspensiCatatan: "2023-12-20", alasan: "suspensi>50bln", catatan: "tanggal catatan janggal (<50 bulan) — verifikasi dengan feed" },
  { symbol: "SKYB", suspensiCatatan: "2020-02-17", alasan: "suspensi>50bln" },
  { symbol: "ENVY", suspensiCatatan: "2020-12-01", alasan: "suspensi>50bln" },
  { symbol: "GOLL", suspensiCatatan: "2019-01-30", alasan: "suspensi>50bln" },
  { symbol: "PLAS", suspensiCatatan: "2018-12-27", alasan: "suspensi>50bln" },
  { symbol: "TRIL", suspensiCatatan: "2019-05-02", alasan: "suspensi>50bln" },
  { symbol: "UNIT", suspensiCatatan: "2021-03-01", alasan: "suspensi>50bln" },
  { symbol: "DUCK", suspensiCatatan: "2021-08-30", alasan: "suspensi>50bln" },
];

export const EMITEN_PEMANTAUAN: readonly string[] = [
  "ALMI", "ALTO", "ARMY", "ARTI", "BEBS", "BIKA", "BIMA", "BOSS", "BTEL", "CBMF",
  "CPRI", "DEAL", "DPNS", "ETWA", "FASW", "FIMP", "GAMA", "GLOB", "HKMU", "HOME",
  "HOTL", "IIKP", "INAF", "INRU", "IPPE", "JSKY", "KAYU", "KBRI", "KIAS", "LMSH",
  "MAGP", "MENN", "MFMI", "MKNT", "MTPS", "MTSM", "NUSA", "PLIN", "PMMP", "POLL",
  "POOL", "POSA", "PTMR", "PURE", "RIMO", "SIMA", "SMCB", "SMRU", "SWAT", "TECH",
  "TGRA", "TGUK", "TOPS", "TRAM", "TRIO", "WICO", "WIKA", "WSKT", "ZBRA",
];

/** Tanggal acuan papan pemantauan khusus: suspensi TERAKHIR ≤ tanggal ini = kejadian target. */
export const TANGGAL_ACUAN_PEMANTAUAN = "2026-06-30";
/** Jumlah kontrol sehat yang dipilih. */
export const JUMLAH_KONTROL = 30;
/**
 * Emiten yang diketahui 404 di endpoint tertentu (docs/data-proof.md, docs/universe-pull.md)
 * — jangan dipanggil lagi. 404 DITAGIH 1 kredit, dan cache 404 hanya 30 hari, maka daftar
 * ini eksplisit agar run setelah cache kedaluwarsa tetap 0 kredit.
 * `dates` (get_quarterly_financial_dates 404 = "Invalid stock symbol", 7 Sep 2026) juga
 * berarti corporate-actions dan financials emiten itu tidak dipanggil (bergantung `dates`).
 */
export const DIKETAHUI_404: Readonly<Record<string, readonly string[]>> = {
  "broker-summary": ["BTEL"],
  "listing-performance": ["SRIL", "TELE", "WIKA", "INAF", "BTEL"],
  dates: ["COWL", "SUGI", "MABA", "SKYB", "KBRI", "NUSA", "RIMO", "SIMA"],
};
