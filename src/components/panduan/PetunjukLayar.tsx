// Tiga petunjuk di atas tiap layar (mockup "howto strip").
// Komponen server-friendly: isi tiap langkah boleh memuat <Istilah> (klien).
//
// Angka 1/2/3 yang dulu terpampang di tiap petunjuk sudah DIBUANG. Header
// menomori tiga HALAMAN (1 Putar ulang, 2 Rakit alarm, 3 Pasang), sedangkan
// petunjuk ini menomori TINDAKAN di dalam satu halaman. Dua deret angka
// berbahasa visual sama tetapi berarti berbeda tampil berbarengan di satu
// layar, dan pembaca yang sedang berada di "langkah 2 dari 3" harus menebak
// mana yang mana. Urutannya sekarang dibawa oleh urutan baca dan oleh <ol>
// (yang tetap menyampaikan urutan ke pembaca layar), bukan oleh angka kedua.
import type { ReactNode } from "react";

interface Props {
  langkah: readonly ReactNode[];
  /** Label aksesibel daftar (default "Cara pakai layar ini"). */
  label?: string;
}

export function PetunjukLayar({ langkah, label = "Cara pakai layar ini" }: Props) {
  return (
    <ol className="mb-4 grid list-none gap-2.5 p-0 text-[13px] md:grid-cols-3" aria-label={label} data-testid="petunjuk-layar">
      {langkah.map((isi, i) => (
        <li key={i} className="rounded-[10px] bg-accent-soft px-3.5 py-2.5 text-ink" data-testid="petunjuk">
          {isi}
        </li>
      ))}
    </ol>
  );
}
