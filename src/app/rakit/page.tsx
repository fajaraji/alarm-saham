import type { Metadata } from "next";

import { Istilah } from "@/components/panduan/Istilah";
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
      <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-ink-3">{TEKS.eyebrow}</p>
      <h1 className="mb-1.5 mt-1 font-display text-[28px] font-extrabold leading-tight tracking-tight text-balance">
        {TEKS.judul}
      </h1>
      <PetunjukLayar
        langkah={[
          <>
            <strong>Seret</strong> blok syarat dari kotak kiri ke papan bergaris putus-putus. Atau ketik keinginanmu dan klik{" "}
            <strong>Minta AI rakit</strong>.
          </>,
          <>
            Klik tombol <strong>ATAU/DAN</strong> di antara blok untuk mengubah cara menggabung. Klik ambang (mis. “
            <Istilah id="laporan_hilang">hilang</Istilah> &gt; 120 hari”) untuk memperketat.
          </>,
          <>
            Klik <strong>Uji ke masa lalu</strong>: berapa yang tertangkap, berapa bulan{" "}
            <Istilah id="lebih_awal">lebih awal</Istilah>, dan berapa <Istilah id="alarm_palsu">alarm palsu</Istilah> pada{" "}
            <Istilah id="kontrol_sehat">saham sehat</Istilah>. AI memberi tahu di mana alarmmu bolong.
          </>,
        ]}
      />

      <PapanRakit />
    </main>
  );
}
