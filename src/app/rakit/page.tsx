import type { Metadata } from "next";

import { PetunjukLayar } from "@/components/panduan/PetunjukLayar";
import { PapanRakit } from "@/components/rakit/PapanRakit";
import { TEKS } from "@/components/rakit/teks";

export const metadata: Metadata = {
  title: "Rakit alarm · Alarm Saham",
  description: "Seret blok syarat ke papan alarm, lalu uji ke masa lalu.",
};

// Header, overlay panduan, dan footer disclaimer datang dari layout akar (tiket 13).
export default function HalamanRakit() {
  return (
    <main className="mx-auto w-full max-w-[1200px] flex-1 px-6 pb-16 pt-6">
      <p className="text-[12px] font-semibold text-ink-3">{TEKS.eyebrow}</p>
      <h1 className="mb-1.5 mt-1 font-display text-[28px] font-extrabold leading-tight tracking-tight text-balance">
        {TEKS.judul}
      </h1>
      <PetunjukLayar
        langkah={[
          <>
            <strong>Seret</strong> blok dari kotak kiri ke papan, atau klik <strong>Minta AI rakit</strong>.
          </>,
          <>
            Klik <strong>ATAU/DAN</strong> untuk mengubah cara menggabung, klik ambang untuk memperketat.
          </>,
          <>
            Klik <strong>Uji ke masa lalu</strong> untuk melihat skornya.
          </>,
        ]}
      />

      <PapanRakit />
    </main>
  );
}
