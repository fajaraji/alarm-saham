// Linimasa bukti di hero beranda: tanda resmi yang sudah terbit SEBELUM sebuah
// saham berhenti diperdagangkan.
//
// Ini BUKAN gambar, bukan ilustrasi, dan bukan tangkapan layar palsu. taste-skill
// Section 4.8 melarang "div-based fake screenshot" (rangka produk yang dibikin
// dari div supaya tampak seperti aplikasi) dan menuntut aset visual nyata, tetapi
// aturan yang sama mengizinkan "a real component preview (an actual mini-version
// of the UI inside the page)". Itulah yang dipakai di sini: baris-baris di bawah
// dirender dari `Kejadian[]` yang SAMA dengan yang dipakai halaman /putar-ulang,
// dibaca dari database, nol panggilan API Sectors.
//
// Kenapa hero butuh ini: beranda lama tidak memperlihatkan produknya sama sekali,
// hanya tiga kartu berisi teks. Nilai jual Alarm Saham adalah urutan tanggalnya,
// jadi urutan tanggal itulah yang pantas jadi visual hero.
import Link from "next/link";

import { fmtTanggal } from "@/lib/putar-ulang/ringkas";
import type { Kejadian } from "@/lib/putar-ulang/kejadian";

/** Warna hanya mengikuti tingkat kejadian; ia menandai keadaan nyata, bukan hiasan. */
const WARNA: Record<Kejadian["tingkat"], string> = {
  crit: "text-crit",
  warn: "text-warn",
  info: "text-ink-3",
};

interface Props {
  symbol: string;
  namaEmiten: string | null;
  /** Tanda yang sudah jadi fakta sebelum kejadian target, terurut lama ke baru. */
  tanda: Kejadian[];
  /** Tanggal kejadian target (suspensi yang berujung dihapus dari bursa). */
  tanggalKejadian: string;
  /** Berapa bulan tanda pertama mendahului kejadian target. */
  bulanLebihAwal: number | null;
  /** true = server ini memakai data contoh, bukan data Sectors. WAJIB dilabeli. */
  contoh: boolean;
}

export function LinimasaBukti({ symbol, namaEmiten, tanda, tanggalKejadian, bulanLebihAwal, contoh }: Props) {
  return (
    <figure className="m-0 overflow-hidden rounded-xl border border-line bg-surface">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line px-4 py-3">
        <span className="font-display text-[15px] font-bold text-ink">
          <span className="font-mono">{symbol}</span>
          {namaEmiten ? <span className="ml-2 text-[13px] font-medium text-ink-2">{namaEmiten}</span> : null}
        </span>
        <span className="text-[12px] text-ink-3">
          {contoh ? "data contoh" : "data resmi lewat Sectors"}
        </span>
      </figcaption>
      {/* Baris data dipisah garis 1px, tanpa kotak kartu per baris:
          VISUAL_DENSITY 6. Tanpa animasi masuk, lihat catatan di globals.css. */}
      <ol className="m-0 list-none p-0">
        {tanda.map((k) => (
          <li
            key={k.id}
            className="flex items-baseline gap-3 border-b border-line px-4 py-2.5 last:border-b-0"
          >
            <time className="w-[88px] shrink-0 font-mono text-[12.5px] text-ink-3" dateTime={k.date}>
              {k.date}
            </time>
            <span className={`text-[13.5px] font-semibold ${WARNA[k.tingkat]}`}>{k.judul}</span>
          </li>
        ))}
      </ol>

      <div className="border-t-2 border-crit bg-crit-soft px-4 py-3">
        <p className="m-0 text-[13.5px] font-semibold text-ink">
          <span className="font-mono">{fmtTanggal(tanggalKejadian)}</span> saham berhenti diperdagangkan
        </p>
        {bulanLebihAwal != null && bulanLebihAwal > 0 ? (
          <p className="m-0 mt-0.5 text-[12.5px] text-ink-2">
            Tanda pertamanya terbit <b className="font-mono">{bulanLebihAwal}</b> bulan sebelum hari itu.
          </p>
        ) : null}
      </div>

      <Link
        href={`/putar-ulang?kode=${symbol}`}
        className="block border-t border-line px-4 py-2.5 text-[13px] font-semibold text-accent no-underline transition-colors hover:bg-surface-2"
      >
        Buka rekaman {symbol} lengkap
      </Link>
    </figure>
  );
}
