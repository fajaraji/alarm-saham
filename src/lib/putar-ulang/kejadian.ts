// Garis waktu "putar ulang" (tiket 10): kejadian ternormalisasi mesin uji →
// daftar tanda bertanggal yang bisa ditampilkan awam, lengkap dengan sumber.
//
// Semua fungsi murni dan bebas DB agar bisa diuji unit dan dipakai di klien.
// Kalimat memakai fakta resmi saja (PLAN.md §5 Q5): tidak ada penilaian.
import { daftarAkhirKuartal, labelKuartal, tambahHari } from "../engine/dates";
import { TENGGAT_LAPORAN_HARI } from "../engine/evaluate";
import type { EmitenEvents } from "../engine/events";

export type JenisKejadian =
  | "suspensi"
  | "laporan_tersedia"
  | "laporan_hilang"
  | "rights_issue"
  | "ekuitas_negatif"
  | "insider_jual";

/** Bobot tampilan: `info` = catatan netral (bukan tanda), `warn`/`crit` = tanda. */
export type Tingkat = "info" | "warn" | "crit";

export interface SumberKejadian {
  /** Nama endpoint Sectors / BEI, mis. "Sectors /v2/suspensions/ (feed BEI)". */
  nama: string;
  /** Tautan dokumen resmi bila ada (mis. PDF pengumuman BEI). */
  url: string | null;
}

export interface Kejadian {
  id: string;
  /** Tanggal kejadian menjadi fakta (YYYY-MM-DD); dipakai filter slider. */
  date: string;
  jenis: JenisKejadian;
  tingkat: Tingkat;
  judul: string;
  rincian: string;
  sumber: SumberKejadian;
}

export interface MasukanKejadian {
  events: EmitenEvents;
  /** Tautan PDF pengumuman BEI per tanggal suspensi (dari kolom pdf_url). */
  pdfUrl?: Record<string, string | null>;
  /** Batas "hari ini" untuk menurunkan laporan hilang (YYYY-MM-DD). */
  today: string;
}

const LABEL_Q: Record<string, string> = { q1: "kuartal 1", q2: "kuartal 2", q3: "kuartal 3", q4: "kuartal 4" };

export function labelPeriode(fiscalYear: number, quarter: string): string {
  return `${LABEL_Q[quarter] ?? quarter} ${fiscalYear}`;
}

export function fmtRupiah(x: number): string {
  const t = x / 1e12;
  if (Math.abs(t) >= 0.01) return `Rp ${t.toLocaleString("id-ID", { maximumFractionDigits: 2 })} triliun`;
  const m = x / 1e9;
  if (Math.abs(m) >= 0.01) return `Rp ${m.toLocaleString("id-ID", { maximumFractionDigits: 2 })} miliar`;
  return `Rp ${Math.round(x).toLocaleString("id-ID")}`;
}

export function sumberSectors(endpoint: string, url: string | null = null): SumberKejadian {
  return { nama: `Sectors ${endpoint}`, url };
}

export interface LaporanHilang {
  /** Akhir periode kuartal yang hilang. */
  periodEnd: string;
  fiscalYear: number;
  quarter: string;
  /** Tanggal kuartal itu dinyatakan hilang: akhir periode + tenggat hari. */
  date: string;
  /** Urutan dalam deretan kuartal hilang berturut-turut yang berakhir di `today` (1 = pertama); null bila kuartal setelahnya tersedia lagi. */
  berturut: number | null;
}

/**
 * Turunkan kuartal "laporan hilang/berhenti" dari daftar kuartal yang tersedia,
 * memakai aturan blok `laporan_hilang` mesin uji: kuartal Q hilang pada t bila
 * akhir(Q) + N hari <= t dan Q tidak ada di daftar; kuartal yang diharapkan =
 * semua akhir kuartal kalender sejak kuartal pertama yang tersedia.
 */
export function turunkanLaporanHilang(
  quarters: EmitenEvents["quarters"],
  today: string,
  tenggatHari: number = TENGGAT_LAPORAN_HARI.longgar,
): LaporanHilang[] {
  if (quarters.length === 0) return [];
  const tersedia = new Set(quarters.map((q) => q.periodEnd));
  const pertama = [...tersedia].sort()[0];
  const terakhirTersedia = [...tersedia].sort().at(-1)!;
  const hilang = daftarAkhirKuartal(pertama, today)
    .filter((akhir) => !tersedia.has(akhir) && tambahHari(akhir, tenggatHari) <= today)
    .map((akhir) => ({ akhir, ...labelKuartal(akhir) }));
  let urutan = 0;
  return hilang.map(({ akhir, fiscalYear, quarter }) => {
    const setelahTerakhir = akhir > terakhirTersedia;
    urutan = setelahTerakhir ? urutan + 1 : 0;
    return {
      periodEnd: akhir,
      fiscalYear,
      quarter,
      date: tambahHari(akhir, tenggatHari),
      berturut: setelahTerakhir ? urutan : null,
    };
  });
}

/** Susun seluruh kejadian garis waktu, urut naik menurut tanggal. */
export function turunkanKejadian(m: MasukanKejadian): Kejadian[] {
  const { events: e, today } = m;
  const pdf = m.pdfUrl ?? {};
  const s = e.symbol;
  const hasil: Kejadian[] = [];

  e.suspensions.forEach((x, i) => {
    hasil.push({
      id: `suspensi-${x.date}-${i}`,
      date: x.date,
      jenis: "suspensi",
      tingkat: "crit",
      judul: "Perdagangan saham dihentikan sementara (suspensi)",
      rincian: x.reason ? `Alasan resmi BEI: "${x.reason}".` : "Alasan tidak tercantum di feed.",
      sumber: sumberSectors("/v2/suspensions/ (feed pengumuman BEI)", pdf[x.date] ?? null),
    });
  });

  e.quarters.forEach((q, i) => {
    hasil.push({
      id: `laporan-${q.periodEnd}-${i}`,
      date: q.periodEnd,
      jenis: "laporan_tersedia",
      tingkat: "info",
      judul: `Laporan keuangan ${labelPeriode(q.fiscalYear, q.quarter)} tersedia`,
      rincian: `Akhir periode ${q.periodEnd}. Endpoint hanya memuat kuartal yang laporannya ada, bukan tanggal penyampaian.`,
      sumber: sumberSectors(`/v2/company/get_quarterly_financial_dates/${s}/`),
    });
  });

  for (const h of turunkanLaporanHilang(e.quarters, today)) {
    const N = TENGGAT_LAPORAN_HARI.longgar;
    const lanjutan =
      h.berturut && h.berturut > 1
        ? ` Kuartal ke-${h.berturut} berturut-turut tanpa laporan sejak kuartal terakhir yang tersedia.`
        : "";
    hasil.push({
      id: `hilang-${h.periodEnd}`,
      date: h.date,
      jenis: "laporan_hilang",
      tingkat: "warn",
      judul: `Laporan keuangan ${labelPeriode(h.fiscalYear, h.quarter)} belum tersedia`,
      rincian: `${N} hari setelah akhir periode ${h.periodEnd}, kuartal ini belum ada di daftar laporan tersedia.${lanjutan}`,
      sumber: sumberSectors(`/v2/company/get_quarterly_financial_dates/${s}/ (turunan aturan laporan hilang)`),
    });
  }

  e.rightIssues.forEach((r, i) => {
    const rasio =
      r.newRatio != null && r.oldRatio != null && r.oldRatio > 0
        ? ` Rasio ${r.oldRatio.toLocaleString("id-ID")} saham lama : ${r.newRatio.toLocaleString("id-ID")} saham baru (≈ ${(r.newRatio / r.oldRatio).toLocaleString("id-ID", { maximumFractionDigits: 2 })}× penambahan).`
        : " Rasio tidak tercantum.";
    hasil.push({
      id: `rights-${r.exDate}-${i}`,
      date: r.exDate,
      jenis: "rights_issue",
      tingkat: "warn",
      judul: "Penerbitan saham baru (rights issue)",
      rincian: `Ex-date ${r.exDate}.${rasio}`,
      sumber: sumberSectors(`/v2/company/corporate-actions/${s}/`),
    });
  });

  e.financials
    .filter((f) => f.totalEquity != null && f.totalEquity < 0)
    .forEach((f, i) => {
      hasil.push({
        id: `ekuitas-${f.date}-${i}`,
        date: f.date,
        jenis: "ekuitas_negatif",
        tingkat: "warn",
        judul: "Ekuitas negatif (utang melebihi harta)",
        rincian: `Total ekuitas ${fmtRupiah(f.totalEquity as number)} pada laporan kuartal berakhir ${f.date}.`,
        sumber: sumberSectors(`/v2/financials/quarterly/${s}/`),
      });
    });

  e.filings
    .filter(
      (f) =>
        f.transactionType === "sell" &&
        f.holderType != null &&
        (f.holderType === "insider" || f.holderType === "institution"),
    )
    .forEach((f, i) => {
      const pct =
        f.sharePctBefore != null && f.sharePctAfter != null
          ? ` Kepemilikan ${f.sharePctBefore.toLocaleString("id-ID", { maximumFractionDigits: 3 })}% → ${f.sharePctAfter.toLocaleString("id-ID", { maximumFractionDigits: 3 })}%.`
          : "";
      hasil.push({
        id: `filing-${f.date}-${i}`,
        date: f.date,
        jenis: "insider_jual",
        tingkat: "warn",
        judul: `Laporan penjualan saham oleh ${f.holderType === "insider" ? "orang dalam" : "institusi"}`,
        rincian: `Filing transaksi jual tanggal ${f.date} (nama pemegang tidak ditampilkan).${pct}`,
        sumber: sumberSectors(`/v2/filings/?symbol=${s}`),
      });
    });

  return hasil.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

/** Hanya tanda (bukan catatan info). */
export function hanyaTanda(kejadian: Kejadian[]): Kejadian[] {
  return kejadian.filter((k) => k.tingkat !== "info");
}
