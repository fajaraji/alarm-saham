import type { Metadata } from "next";

import { Istilah } from "@/components/panduan/Istilah";
import { PetunjukLayar } from "@/components/panduan/PetunjukLayar";
import { PanelPasang } from "@/components/pasang/PanelPasang";
import { TEKS } from "@/components/pasang/teks";
import { sumberSitus } from "@/lib/sumber-situs";

export const metadata: Metadata = {
  title: "Pasang · Alarm Saham",
  description: "Pasang alarm untuk portofoliomu: cek saham ke data di server ini, peta hijau/kuning/merah, dan pesan penjelasan.",
};

// Header, overlay panduan, dan footer disclaimer datang dari layout akar (tiket 13).
//
// Lede halaman mengikuti sumber data server: kalimat "Alarm mengecek data resmi
// di server kami" tidak boleh muncul saat servernya berjalan di atas fixture.
export default async function HalamanPasang() {
  const { nyata } = await sumberSitus();
  return (
    <main className="mx-auto w-full max-w-[1200px] flex-1 px-6 pb-16 pt-6">
      <p className="text-[12px] font-semibold text-ink-3">{TEKS.eyebrow}</p>
      <h1 className="mb-1.5 mt-1 font-display text-[28px] font-extrabold leading-tight tracking-tight text-balance">{TEKS.judul}</h1>
      {/* Kalimat pembuka lama ("Tambahkan saham yang kamu pegang, pilih alarm
          yang aktif, lalu klik Cek sekarang") dibuang: baris petunjuk di bawah
          mengatakan persis hal yang sama di langkah 1 dan 2. Yang disisakan di
          sini justru yang TIDAK ada di petunjuk, yaitu perilaku kredit dan
          data. */}
      <p className="mb-4 max-w-[70ch] text-[13.5px] text-ink-2">
        {nyata ? (
          <>Alarm mengecek data resmi di server kami tanpa memakai <Istilah id="kredit_sectors">kredit</Istilah>;</>
        ) : (
          <>
            Server ini belum terhubung ke database Sectors, jadi alarm mengecek <b>data contoh</b> (bukan data Sectors
            nyata) tanpa memakai <Istilah id="kredit_sectors">kredit</Istilah>;
          </>
        )}{" "}
        data terkini (broker, <Istilah id="free_float">free float</Istilah>, harga) hanya ditarik kalau kamu minta.
      </p>
      <PetunjukLayar
        langkah={[
          <>Tambahkan saham yang kamu pegang (kode 4 huruf).</>,
          <>
            Klik <strong>Cek sekarang</strong>: hijau aman, kuning satu tanda, merah alarm berbunyi.
          </>,
          <>Baca pesan penjelasannya: syarat mana, tanggalnya, dan sumbernya.</>,
        ]}
      />

      <PanelPasang />
    </main>
  );
}
