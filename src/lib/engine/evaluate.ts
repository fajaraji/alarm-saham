// Mesin evaluasi: "apakah alarm berbunyi pada tanggal t?" — fungsi murni.
//
// Aturan emas anti-lookahead: setiap blok HANYA melihat baris kejadian yang
// bertanggal <= t. Sumber kejadian (events.ts) tidak memfilter; pemotongan
// dilakukan di sini lewat `sampai(t)`.
//
// Definisi blok mengikuti docs/data-proof.md §2 (keputusan tiket 04). Asumsi
// yang tidak tercantum di sana ditandai "ASUMSI" dan dirangkum di
// docs/mesin-uji.md.
import { daftarAkhirKuartal, labelKuartal, tambahBulan, tambahHari, tambahTahun } from "./dates";
import type { EmitenEvents, KejadianSuspensi } from "./events";
import type { BlockKind, Rule, Threshold } from "./rules";

export interface Reason {
  kind: BlockKind;
  threshold: Threshold;
  detail: string;
}

export interface FireResult {
  fired: boolean;
  /** Blok yang terpenuhi pada t (walau `fired` false untuk combine 'all'). */
  reasons: Reason[];
}

type Evaluator = (e: EmitenEvents, t: string, threshold: Threshold) => string | null;

/** Hari tenggat "laporan hilang" setelah akhir periode kuartal. */
export const TENGGAT_LAPORAN_HARI: Record<Threshold, number> = { longgar: 120, ketat: 180 };
/** Jendela ke belakang untuk filing orang dalam. */
export const JENDELA_INSIDER_HARI = 180;
/** Ambang rasio dilusi rights issue (new_ratio / old_ratio) untuk ketat. */
export const RASIO_DILUSI_KETAT = 0.5;
/** Ambang penurunan ekuitas YoY (proporsi) untuk ketat. */
export const PENURUNAN_EKUITAS_KETAT = 0.5;
/** Ambang total penurunan kepemilikan (poin persen) untuk insider ketat. */
export const INSIDER_POIN_KETAT = 1;

function fmtPct(x: number): string {
  return `${(x * 100).toFixed(0)}%`;
}

function fmtRp(x: number): string {
  const triliun = x / 1e12;
  if (Math.abs(triliun) >= 0.01) return `Rp ${triliun.toFixed(2)} T`;
  return `Rp ${Math.round(x).toLocaleString("id-ID")}`;
}

// ---------------------------------------------------------------------------
// Blok 1: Saham disuspensi
// ---------------------------------------------------------------------------

/**
 * Suspensi karena gerak harga: BEI menghentikan perdagangan sehari-dua untuk
 * meredam lonjakan ("peningkatan harga kumulatif yang signifikan", "dalam
 * rangka cooling down"). Itu jeda rutin bursa, bukan tanda perusahaannya
 * bermasalah, padahal di data kami jumlahnya 460 dari 583 suspensi (272 dari
 * 294 dalam 12 bulan sampai 7 Sep 2026). Alasan kosong tetap dihitung: tanpa
 * alasan kita tidak bisa bilang itu jeda rutin (tiket 39).
 */
const POLA_GERAK_HARGA = /cooling down|harga kumulatif/i;

export function suspensiGerakHarga(x: KejadianSuspensi): boolean {
  return x.reason !== null && POLA_GERAK_HARGA.test(x.reason);
}

/** Suspensi bertanggal <= t yang BUKAN jeda gerak harga. */
export function suspensiMasalah(e: EmitenEvents, t: string): KejadianSuspensi[] {
  return e.suspensions.filter((x) => x.date <= t && !suspensiGerakHarga(x));
}

/**
 * Tanggal kejadian target yang BENAR-BENAR diukur: suspensi masalah PALING AWAL
 * yang bertanggal <= `tercatat`; bila tidak ada, tanggal catatan itu sendiri.
 *
 * Feed BEI mengumumkan ulang suspensi yang masih berjalan ("Suspend more than
 * 6 month", 56 baris di data kami), dan tanggal catatan delisting jatuh
 * bertahun-tahun sesudah sahamnya berhenti diperdagangkan. Mengukur ke tanggal
 * terakhir membuat "tanda lebih awal" terlihat panjang padahal pemegang saham
 * sudah tidak bisa menjual sejak suspensi pertama. LMAS contohnya: dicatat
 * 20 Des 2023, padahal sudah disuspensi 1 Agu 2022 — klaimnya turun dari 19
 * bulan menjadi 3 bulan. Tanda hanya berguna bila muncul SEBELUM saham berhenti
 * diperdagangkan, jadi itu yang diukur (tiket 39).
 *
 * `suspensiTambahan` = penghentian perdagangan dari pengumuman publik yang
 * tidak ada di feed kami (lihat SUSPENSI_PUBLIK di universe/daftar.ts).
 */
export function targetTerukur(tercatat: string, e: EmitenEvents, suspensiTambahan?: string | null): string {
  const s = suspensiMasalah(e, tercatat).map((x) => x.date);
  if (suspensiTambahan && suspensiTambahan <= tercatat) s.push(suspensiTambahan);
  return s.length ? s.reduce((a, b) => (b < a ? b : a)) : tercatat;
}

const suspensi: Evaluator = (e, t, ambang) => {
  const s = suspensiMasalah(e, t);
  if (ambang === "longgar") {
    // Pernah disuspensi dalam 12 bulan sebelum t (inklusif).
    const batas = tambahBulan(t, -12);
    const kena = s.filter((x) => x.date > batas);
    if (kena.length === 0) return null;
    const terbaru = kena[kena.length - 1];
    return `suspensi ${terbaru.date} (dalam 12 bulan sebelum ${t})`;
  }
  // Ketat: ada suspensi yang sudah berumur >= 6 bulan pada t dan "belum dicabut".
  // ASUMSI: feed suspensions tidak memuat tanggal pencabutan; suspensi dianggap
  // masih berlaku selama TIDAK ada kuartal laporan baru (akhir periode > tanggal
  // suspensi dan <= t) di daftar kuartal tersedia.
  const kuartal = e.quarters.filter((q) => q.periodEnd <= t);
  for (let i = s.length - 1; i >= 0; i--) {
    const x = s[i];
    if (tambahBulan(x.date, 6) > t) continue;
    const dicabut = kuartal.some((q) => q.periodEnd > x.date);
    if (!dicabut) return `suspensi ${x.date} sudah >= 6 bulan tanpa kuartal laporan baru hingga ${t}`;
  }
  return null;
};

// ---------------------------------------------------------------------------
// Blok 2: Laporan keuangan hilang/berhenti
// ---------------------------------------------------------------------------
const laporanHilang: Evaluator = (e, t, ambang) => {
  const N = TENGGAT_LAPORAN_HARI[ambang];
  // Anti-lookahead: daftar kuartal tersedia hanya yang akhir periodenya <= t.
  const tersedia = new Set(e.quarters.filter((q) => q.periodEnd <= t).map((q) => q.periodEnd));
  if (tersedia.size === 0) {
    // ASUMSI: tanpa satu pun kuartal sebelum t kita tidak bisa membedakan
    // "belum tercatat" dari "berhenti melapor" → blok tidak berbunyi.
    return null;
  }
  const pertama = [...tersedia].sort()[0];
  // Kuartal yang DIHARAPKAN: semua akhir kuartal kalender sejak kuartal pertama
  // yang tersedia sampai t. Kuartal Q hilang bila akhir_periode(Q) + N hari <= t
  // dan Q tidak ada di daftar tersedia.
  const hilang = daftarAkhirKuartal(pertama, t).filter(
    (akhir) => !tersedia.has(akhir) && tambahHari(akhir, N) <= t,
  );
  if (hilang.length === 0) return null;
  const q = labelKuartal(hilang[0]);
  const tambahan = hilang.length > 1 ? ` (+${hilang.length - 1} kuartal lain)` : "";
  return `laporan ${q.fiscalYear} ${q.quarter} (akhir ${hilang[0]}) belum tersedia ${N} hari setelahnya${tambahan}`;
};

// ---------------------------------------------------------------------------
// Blok 3: Aksi korporasi dilutif (rights issue)
// ---------------------------------------------------------------------------
const aksiDilutif: Evaluator = (e, t, ambang) => {
  const ri = e.rightIssues.filter((r) => r.exDate <= t);
  if (ri.length === 0) return null;
  if (ambang === "longgar") {
    const terbaru = ri[ri.length - 1];
    return `rights issue ex-date ${terbaru.exDate}`;
  }
  // Ketat: rasio dilusi new/old >= 0.5. Rights issue tanpa rasio tidak dihitung.
  for (let i = ri.length - 1; i >= 0; i--) {
    const r = ri[i];
    if (r.newRatio == null || r.oldRatio == null || r.oldRatio <= 0) continue;
    const rasio = r.newRatio / r.oldRatio;
    if (rasio >= RASIO_DILUSI_KETAT) {
      return `rights issue ex-date ${r.exDate} rasio ${rasio.toFixed(2)}x (>= ${RASIO_DILUSI_KETAT})`;
    }
  }
  return null;
};

// ---------------------------------------------------------------------------
// Blok 4: Utang lebih besar dari harta (ekuitas)
// ---------------------------------------------------------------------------
const ekuitasNegatif: Evaluator = (e, t, ambang) => {
  const keu = e.financials.filter((q) => q.date <= t && q.totalEquity != null);
  if (keu.length === 0) return null;
  const akhir = keu[keu.length - 1];
  const e1 = akhir.totalEquity as number;
  if (ambang === "longgar") {
    if (e1 < 0) return `ekuitas ${fmtRp(e1)} negatif pada kuartal ${akhir.date}`;
    return null;
  }
  // Ketat: ekuitas turun >= 50% YoY. ASUMSI: pembanding = kuartal dengan tanggal
  // tepat satu tahun sebelumnya dan ekuitas positif; tanpa pembanding → tidak berbunyi.
  const setahunLalu = tambahTahun(akhir.date, -1);
  const basis = keu.find((q) => q.date === setahunLalu);
  if (!basis || (basis.totalEquity as number) <= 0) return null;
  const e0 = basis.totalEquity as number;
  const turun = (e0 - e1) / e0;
  if (turun >= PENURUNAN_EKUITAS_KETAT) {
    return `ekuitas turun ${fmtPct(turun)} YoY (${fmtRp(e0)} pada ${basis.date} → ${fmtRp(e1)} pada ${akhir.date})`;
  }
  return null;
};

// ---------------------------------------------------------------------------
// Blok 5: Orang dalam menjual (kelas A-terbatas, data Sectors mulai 2024)
// ---------------------------------------------------------------------------
const HOLDER_ORANG_DALAM = new Set(["insider", "institution"]);

const insiderJual: Evaluator = (e, t, ambang) => {
  const batas = tambahHari(t, -JENDELA_INSIDER_HARI);
  const jual = e.filings.filter(
    (f) =>
      f.date <= t &&
      f.date > batas &&
      f.transactionType === "sell" &&
      f.holderType != null &&
      HOLDER_ORANG_DALAM.has(f.holderType),
  );
  if (jual.length === 0) return null;
  if (ambang === "longgar") {
    return `${jual.length} filing jual oleh insider/institusi dalam ${JENDELA_INSIDER_HARI} hari sebelum ${t}`;
  }
  // Ketat: total penurunan kepemilikan (poin persen) >= 1.
  const poin = jual.reduce((acc, f) => {
    if (f.sharePctBefore == null || f.sharePctAfter == null) return acc;
    return acc + Math.max(0, f.sharePctBefore - f.sharePctAfter);
  }, 0);
  if (poin >= INSIDER_POIN_KETAT) {
    return `insider/institusi melepas total ${poin.toFixed(2)} poin persen saham dalam ${JENDELA_INSIDER_HARI} hari sebelum ${t}`;
  }
  return null;
};

export const EVALUATORS: Record<BlockKind, Evaluator> = {
  suspensi,
  laporan_hilang: laporanHilang,
  aksi_dilutif: aksiDilutif,
  ekuitas_negatif: ekuitasNegatif,
  insider_jual: insiderJual,
};

/**
 * Apakah aturan berbunyi untuk emiten `events` pada tanggal `t` (YYYY-MM-DD),
 * memakai hanya data bertanggal <= t.
 */
export function fires(rule: Rule, events: EmitenEvents, t: string): FireResult {
  const reasons: Reason[] = [];
  for (const b of rule.blocks) {
    const detail = EVALUATORS[b.kind](events, t, b.threshold);
    if (detail !== null) reasons.push({ kind: b.kind, threshold: b.threshold, detail });
  }
  const fired = rule.combine === "any" ? reasons.length > 0 : reasons.length === rule.blocks.length;
  return { fired, reasons };
}
