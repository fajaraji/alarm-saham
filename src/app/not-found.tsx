// Halaman 404 kustom (App Router). Dirinya dirender di dalam layout akar, jadi
// header, tombol Panduan, dan footer disclaimer sudah ada; yang hilang cuma isi.
//
// Keadaan tepi tetap harus menyebut keadaan DAN tindakan berikutnya (semangat
// R-27). Yang paling mungkin sampai ke sini: salah tempel satu karakter di
// tautan /putar-ulang?kode=… atau mengetik alamat halaman yang keliru. Karena
// itu jalan keluarnya mengarah ke langkah 1 (beranda), bukan sekadar "kembali".
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Halaman tidak ditemukan · Alarm Saham",
  description: "Alamat yang dituju tidak ada. Kembali ke beranda untuk mulai dari langkah 1.",
};

export default function TidakDitemukan() {
  return (
    <main id="konten" className="mx-auto w-full max-w-[720px] flex-1 px-6 pb-16 pt-10">
      <p className="text-[12px] font-semibold text-ink-3">Galat 404</p>
      <h1 className="mb-2 mt-1 font-display text-[28px] font-extrabold leading-tight tracking-tight text-balance sm:text-[32px]">
        Halaman ini tidak ada.
      </h1>
      <p className="m-0 max-w-[60ch] text-[14.5px] leading-relaxed text-ink-2">
        Alamat yang dituju tidak cocok dengan halaman mana pun di sini. Kemungkinan tautannya salah tempel, atau
        halamannya sudah berpindah.
      </p>
      <div className="mt-7 flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-block rounded-lg bg-accent px-5 py-2.5 text-[14px] font-semibold text-accent-ink no-underline transition-[transform,opacity] hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:translate-y-px"
        >
          Kembali ke beranda
        </Link>
        <Link
          href="/kamus"
          className="inline-block rounded-lg border border-line px-5 py-2.5 text-[14px] font-semibold text-ink no-underline transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Kamus istilah
        </Link>
      </div>
    </main>
  );
}