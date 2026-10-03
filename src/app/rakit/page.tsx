import type { Metadata } from "next";
import { Fragment } from "react";

import { NavigasiLangkah } from "@/components/panduan/NavigasiLangkah";
import { PetunjukLayar } from "@/components/panduan/PetunjukLayar";
import { PapanRakit } from "@/components/rakit/PapanRakit";
import { TEKS } from "@/components/rakit/teks";

export const metadata: Metadata = {
  title: "Rakit alarm · Alarm Saham",
  description: "Seret blok syarat ke papan alarm, lalu uji ke masa lalu.",
};

// Header, overlay panduan, dan footer disclaimer datang dari layout akar (tiket 13).
//
// Halaman ini SENGAJA tidak memakai kelas animasi masuk `.masuk`. Penjelasan
// lengkapnya di src/components/rakit/sensor.ts: seluruh peredam klik di sana
// bertumpu pada koordinat yang diukur SESUDAH pengguna menyentuh layar, dan
// animasi transform 0,8 detik membuat koordinat yang diukur sebelum animasinya
// tenang menjadi salah. Itu bukan cacat teori: tests/e2e/rakit.spec.ts:197 gagal
// begitu kelasnya dipasang, karena klik kedua jatuh ke tombol yang sudah
// bergeser. Aturan yang berlaku: jangan menganimasikan wadah yang berisi sasaran
// seret.
export default function HalamanRakit() {
  return (
    <main id="konten" className="mx-auto w-full max-w-[1600px] flex-1 px-6 pb-16 pt-6">
      {/* Eyebrow "Langkah 2 dari 3" dibuang (audit-003 temuan 5): chip bernomor di
          header sudah menyebut posisi halaman, dan rantai Sebelumnya/Berikutnya
          mengulanginya lagi di bawah. Tiga kali satu fakta di satu layar =
          DESIGN.md butir 1. */}
      <h1 className="mb-1.5 mt-1 font-display text-[28px] font-extrabold leading-tight tracking-tight text-balance">
        {TEKS.judul}
      </h1>
      <PetunjukLayar
        langkah={[
          <Fragment key="seret">
            <strong>Seret</strong> blok dari kotak kiri ke papan, atau klik <strong>Minta AI rakit</strong>.
          </Fragment>,
          <Fragment key="gabung">
            Klik <strong>ATAU/DAN</strong> untuk mengubah cara menggabung, klik ambang untuk memperketat.
          </Fragment>,
          <Fragment key="uji">
            Klik <strong>Uji ke masa lalu</strong> untuk melihat skornya.
          </Fragment>,
        ]}
      />

      <PapanRakit />
      <NavigasiLangkah sekarang="/rakit" />
    </main>
  );
}
