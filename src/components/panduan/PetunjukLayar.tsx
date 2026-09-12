"use client";
// Tiga petunjuk di atas tiap layar (mockup "howto strip").
//
// Angka 1/2/3 yang dulu terpampang di tiap petunjuk sudah DIBUANG. Header
// menomori tiga HALAMAN (1 Putar ulang, 2 Rakit alarm, 3 Pasang), sedangkan
// petunjuk ini menomori TINDAKAN di dalam satu halaman. Dua deret angka
// berbahasa visual sama tetapi berarti berbeda tampil berbarengan di satu
// layar, dan pembaca yang sedang berada di "langkah 2 dari 3" harus menebak
// mana yang mana. Urutannya sekarang dibawa oleh urutan baca dan oleh <ol>
// (yang tetap menyampaikan urutan ke pembaca layar), bukan oleh angka kedua.
//
// Sejak U1 barisnya bisa DILIPAT, dan ini alasannya: baris ini memakan 45-68
// kata, yaitu 25-33% seluruh kata di halaman alat, dan mendorong alatnya ke
// y=288-395px. Padahal overlay Panduan SUDAH mengajarkan ketiga langkah yang
// sama pada kunjungan pertama. Jadi begitu pengguna menyelesaikan overlay itu,
// baris ini menutup diri; penanda yang dipakai adalah localStorage yang SAMA
// (KUNCI_PANDUAN_SELESAI), bukan kunci baru, supaya tidak ada dua sumber
// kebenaran tentang "pengguna sudah paham".
//
// `<details>` dipilih, bukan panel buatan sendiri: ia bisa dibuka-tutup tanpa
// JavaScript, peramban sudah menangani papan tuts dan pembaca layar, dan render
// server tetap TERBUKA sehingga pengunjung pertama (dan pengguna tanpa JS)
// selalu melihat petunjuknya.
import { useState, useSyncExternalStore, type ReactNode } from "react";

import { KUNCI_PANDUAN_SELESAI } from "./kamus";

interface Props {
  langkah: readonly ReactNode[];
  /** Label aksesibel daftar (default "Cara pakai layar ini"). */
  label?: string;
}

/** localStorage tidak berubah selama halaman hidup di tab ini, jadi tanpa langganan. */
const tanpaLangganan = () => () => {};

function sudahSelesaiPanduan(): boolean {
  try {
    return window.localStorage.getItem(KUNCI_PANDUAN_SELESAI) === "1";
  } catch {
    // localStorage bisa dilarang (mode privat, site data diblokir). Anggap
    // belum paham: lebih baik petunjuknya tampil daripada hilang tanpa sebab.
    return false;
  }
}

export function PetunjukLayar({ langkah, label = "Cara pakai layar ini" }: Props) {
  // `useSyncExternalStore`, bukan setState di dalam useEffect: snapshot server
  // selalu `false` (petunjuk TERBUKA saat render server dan saat hidrasi),
  // lalu React beralih ke snapshot klien yang membaca localStorage. Itu jalur
  // yang memang disediakan React untuk membaca state peramban tanpa memicu
  // ketidakcocokan hidrasi.
  const sudahPaham = useSyncExternalStore(tanpaLangganan, sudahSelesaiPanduan, () => false);
  /** null = ikut localStorage; true/false = pengguna sendiri yang membuka/menutup di halaman ini. */
  const [dipilihPengguna, setDipilihPengguna] = useState<boolean | null>(null);
  const terbuka = dipilihPengguna ?? !sudahPaham;
  const setTerbuka = setDipilihPengguna;

  return (
    <details
      className="mb-4"
      open={terbuka}
      onToggle={(e) => setTerbuka(e.currentTarget.open)}
      data-testid="petunjuk-wadah"
    >
      <summary className="mb-2 cursor-pointer list-none text-[12.5px] font-semibold text-accent marker:hidden [&::-webkit-details-marker]:hidden">
        {terbuka ? "Sembunyikan cara pakai layar ini" : "Cara pakai layar ini"}
      </summary>
      <ol
        className="grid list-none gap-2.5 p-0 text-[13px] md:grid-cols-3"
        aria-label={label}
        data-testid="petunjuk-layar"
      >
        {langkah.map((isi, i) => (
          <li key={i} className="rounded-[10px] bg-accent-soft px-3.5 py-2.5 text-ink" data-testid="petunjuk">
            {isi}
          </li>
        ))}
      </ol>
    </details>
  );
}
