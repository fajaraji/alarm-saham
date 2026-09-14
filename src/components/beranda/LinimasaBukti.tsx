// Linimasa bukti di beranda: tanda yang sudah tercatat untuk satu emiten.
//
// Ini BUKAN gambar, bukan ilustrasi, dan bukan tangkapan layar palsu. Baris di
// bawah dirender dari `Kejadian[]` yang SAMA dengan yang dipakai /putar-ulang,
// dibaca dari database, nol panggilan API Sectors (taste-skill Section 4.8
// mengizinkan "a real component preview" sebagai visual, dan melarang rangka
// produk palsu dari div).
//
// Pita merah "6 Jun 2025 saham berhenti diperdagangkan" yang dulu ada di bawah
// linimasa DIBUANG karena tidak akurat. Tanggal itu adalah tanggal catatan
// suspensi dari sumber publik (`suspensiCatatan` di src/lib/universe/daftar.ts),
// bukan hari perdagangan berhenti, dan baris di atasnya justru menunjukkan
// perdagangan TELE sudah dihentikan sejak 2024-12-27. Penjelasan tentang akhir
// cerita emiten ini sekarang ditulis di halaman, dari tanggal efektif
// penghapusan yang bersumber.
import Link from "next/link";

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
  /** Tanda yang ditampilkan, terurut lama ke baru. */
  tanda: Kejadian[];
  /** true = server ini memakai data contoh, bukan data Sectors. WAJIB dilabeli. */
  contoh: boolean;
}

export function LinimasaBukti({ symbol, namaEmiten, tanda, contoh }: Props) {
  return (
    <figure className="m-0 overflow-hidden rounded-xl border border-line bg-surface">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line px-4 py-3">
        <span className="font-display text-[15px] font-bold text-ink">
          <span className="font-mono">{symbol}</span>
          {namaEmiten ? <span className="ml-2 text-[13px] font-medium text-ink-2">{namaEmiten}</span> : null}
        </span>
        <span className="text-[12px] text-ink-3">{contoh ? "data contoh" : "lewat Sectors"}</span>
      </figcaption>

      {/* Baris data dipisah garis 1px, tanpa kotak kartu per baris. Tanpa animasi
          masuk: versi beranimasi ditolak gerbang kontras axe di kedua tema. */}
      <ol className="m-0 list-none p-0">
        {tanda.map((k) => (
          <li key={k.id} className="flex items-baseline gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
            <time className="w-[88px] shrink-0 font-mono text-[12.5px] text-ink-3" dateTime={k.date}>
              {k.date}
            </time>
            <span className={`text-[13.5px] font-semibold ${WARNA[k.tingkat]}`}>{k.judul}</span>
          </li>
        ))}
      </ol>

      <Link
        href={`/putar-ulang?kode=${symbol}`}
        className="block border-t border-line px-4 py-2.5 text-[13px] font-semibold text-accent no-underline transition-colors hover:bg-surface-2"
      >
        Buka rekaman {symbol} lengkap
      </Link>
    </figure>
  );
}
