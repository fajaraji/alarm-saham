"use client";
// Overlay panduan 3 langkah (mockup yang disetujui pemilik). Tampil otomatis
// pada kunjungan pertama (localStorage `alarm-saham:panduan-selesai` belum ada);
// bisa dibuka lagi lewat tombol Panduan di header. Esc / "Saya sudah paham"
// menutup dan menandai selesai; "Mulai dari langkah 1" → /putar-ulang.
import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";

import { KUNCI_PANDUAN_SELESAI } from "./kamus";
import { usePanduan } from "./PanduanContext";

function sudahSelesai(): boolean {
  try {
    return window.localStorage.getItem(KUNCI_PANDUAN_SELESAI) === "1";
  } catch {
    return true; // tanpa storage (mode privat ketat): jangan ganggu tiap muat ulang
  }
}

function tandaiSelesai() {
  try {
    window.localStorage.setItem(KUNCI_PANDUAN_SELESAI, "1");
  } catch {
    /* abaikan */
  }
}

/**
 * Isi tiga langkah panduan MENGIKUTI sumber data server: pada jalur data contoh
 * dialog ini dulu tetap menjanjikan data resmi dan jumlah universe nyata,
 * padahal universenya 8 emiten contoh.
 *
 * Angka universe nyata TIDAK ditulis sebagai satu jumlah gabungan di sini —
 * komposisinya (18 + 59 + 30) yang disebut, supaya tidak ada lagi kalimat UI
 * yang memakukan total universe (dijaga tests/unit/copy/cakupan.test.ts).
 */
export function langkahPanduan(sumberNyata: boolean) {
  return [
    {
      judul: "Putar ulang.",
      teks: "Ketik kode saham, lalu geser slider waktu ke kiri. Lihat tanda resmi apa yang sudah kelihatan sebelum sahamnya dibekukan atau dihapus dari bursa.",
    },
    {
      judul: "Rakit alarm.",
      teks: sumberNyata
        ? "Seret blok syarat dari kotak kiri ke papan alarm (atau minta AI merakit). Klik “Uji ke masa lalu”: alarmmu dijalankan ke seluruh universe uji: 18 saham yang dihapus dari bursa, 59 di pemantauan khusus, 30 yang sehat."
        : "Seret blok syarat dari kotak kiri ke papan alarm (atau minta AI merakit). Klik “Uji ke masa lalu”: alarmmu dijalankan ke seluruh emiten yang ada di data contoh server ini, bukan ke universe uji yang kami tarik dari Sectors.",
    },
    {
      judul: "Pasang.",
      teks: sumberNyata
        ? "Tambahkan saham yang kamu pegang. Alarm mengecek data resmi dan menjelaskan syarat mana yang terpenuhi, tanggalnya, dan sumbernya."
        : "Tambahkan saham yang kamu pegang. Alarm mengecek data contoh di server ini dan menjelaskan syarat mana yang terpenuhi, tanggalnya, dan sumbernya.",
    },
  ] as const;
}

/** Daftar langkah untuk jalur data nyata (dipakai tes & dokumentasi). */
export const LANGKAH_PANDUAN = langkahPanduan(true);

export interface PropsOverlayPanduan {
  /** true = database berisi data Sectors nyata; false = fixture data contoh. */
  sumberNyata: boolean;
}

export function OverlayPanduan({ sumberNyata }: PropsOverlayPanduan) {
  const { terbuka, buka, tutup } = usePanduan();
  const kartu = useRef<HTMLDivElement>(null);
  const pemicu = useRef<Element | null>(null);

  // Kunjungan pertama → buka otomatis (setelah hidrasi, agar SSR & klien sama).
  useEffect(() => {
    if (!sudahSelesai()) buka();
  }, [buka]);

  const selesai = useCallback(() => {
    tandaiSelesai();
    tutup();
  }, [tutup]);

  useEffect(() => {
    if (!terbuka) return;
    pemicu.current = document.activeElement;
    kartu.current?.focus();
    const sebelumnya = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Jebak fokus di dalam kartu: `aria-modal` menyembunyikan latar dari pembaca
    // layar tetapi TIDAK mengubah urutan Tab, sehingga tanpa ini pengguna
    // keyboard bisa keluar ke tautan header yang tertutup lapisan gelap.
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") {
        selesai();
        return;
      }
      if (ev.key !== "Tab" || !kartu.current) return;
      const bisaFokus = [...kartu.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
      if (bisaFokus.length === 0) return;
      const pertama = bisaFokus[0];
      const terakhir = bisaFokus[bisaFokus.length - 1];
      const kini = document.activeElement;
      if (ev.shiftKey && (kini === pertama || kini === kartu.current)) {
        ev.preventDefault();
        terakhir.focus();
      } else if (!ev.shiftKey && kini === terakhir) {
        ev.preventDefault();
        pertama.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = sebelumnya;
      if (pemicu.current instanceof HTMLElement) pemicu.current.focus();
    };
  }, [terbuka, selesai]);

  if (!terbuka) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(15,20,32,.55)] p-5"
      data-testid="overlay-panduan"
      data-sumber={sumberNyata ? "db" : "fixture"}
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) selesai();
      }}
    >
      <div
        ref={kartu}
        role="dialog"
        aria-modal="true"
        aria-labelledby="judul-panduan"
        tabIndex={-1}
        className="w-full max-w-[560px] rounded-2xl bg-surface p-7 text-ink shadow-panel outline-none"
      >
        <h2 id="judul-panduan" className="m-0 mb-1.5 font-display text-2xl font-extrabold tracking-tight">
          Alarm Saham: cara pakainya dalam 3 langkah
        </h2>
        <p className="m-0 mb-3.5 text-ink-2">
          {sumberNyata ? (
            <>Semua yang tampil adalah fakta dari data resmi (feed BEI lewat Sectors).</>
          ) : (
            <>
              Server ini belum terhubung ke database Sectors, jadi yang tampil adalah <b>data contoh</b> (bukan data
              Sectors nyata). Bentuknya meniru feed BEI lewat Sectors, tetapi angkanya ilustratif.
            </>
          )}{" "}
          Alarm Saham adalah alat informasi, bukan saran investasi.
        </p>
        <ol className="m-0 mb-4 flex list-none flex-col gap-2.5 p-0">
          {langkahPanduan(sumberNyata).map((l, i) => (
            <li key={l.judul} className="flex items-start gap-3">
              <b
                aria-hidden="true"
                className="grid h-[26px] w-[26px] flex-none place-items-center rounded-full bg-accent font-mono text-xs text-accent-ink"
              >
                {i + 1}
              </b>
              <span className="text-ink-2">
                <strong className="text-ink">{l.judul}</strong> {l.teks}
              </span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/putar-ulang"
            onClick={selesai}
            className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink no-underline"
            data-testid="panduan-mulai"
          >
            Mulai dari langkah 1
          </Link>
          <button
            type="button"
            onClick={selesai}
            className="rounded-lg border border-line-strong bg-surface px-4 py-2 text-[13px] font-semibold text-ink hover:bg-surface-2"
            data-testid="panduan-paham"
          >
            Saya sudah paham
          </button>
        </div>
      </div>
    </div>
  );
}
