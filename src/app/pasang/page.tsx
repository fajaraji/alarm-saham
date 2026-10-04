import type { Metadata } from "next";
import { Fragment } from "react";

import { Istilah } from "@/components/panduan/Istilah";
import { NavigasiLangkah } from "@/components/panduan/NavigasiLangkah";
import { PetunjukLayar } from "@/components/panduan/PetunjukLayar";
import { PanelPasang } from "@/components/pasang/PanelPasang";
import { TEKS } from "@/components/pasang/teks";
import { getEventSource } from "@/lib/engine/sumber";
import { daftarBisaDicari } from "@/lib/putar-ulang/daftar-cari";
import { sumberSitus } from "@/lib/sumber-situs";
import { botAktif } from "@/lib/telegram/status";

export const metadata: Metadata = {
  title: "Pasang · Alarm Saham",
  description: "Pasang alarm untuk portofolio: cek saham ke data di server ini, peta hijau/kuning/merah, dan pesan penjelasan.",
};

// Halaman ini TIDAK boleh di-prerender: daftar saran kotak kode dihitung dari
// data server (dan ledenya memakai sumberSitus() yang menunda ke request time).
export const dynamic = "force-dynamic";

// Header, overlay panduan, dan footer disclaimer datang dari layout akar (tiket 13).
//
// Lede halaman mengikuti sumber data server: kalimat "Alarm mengecek data resmi
// di server kami" tidak boleh muncul saat servernya berjalan di atas fixture.
export default async function HalamanPasang() {
  const { nyata } = await sumberSitus();
  // Saran ketik kotak kode: emiten yang benar-benar bisa dicari di server ini,
  // dari sumber yang sama dengan kotak cari /putar-ulang. Dihitung di server
  // supaya jumlahnya tidak pernah dipaku di komponen klien dan jalur data
  // contoh tetap jujur (hanya emiten fixture, bukan angka universe nyata).
  const sumber = await getEventSource();
  const universe = await sumber.universe();
  const opsi = await daftarBisaDicari(sumber.db, universe);
  return (
    <main id="konten" className="masuk mx-auto w-full max-w-[1600px] flex-1 px-6 pb-16 pt-6">
      {/* Eyebrow "Langkah 3 dari 3" dibuang (audit-003 temuan 5), alasan sama
          dengan /rakit: posisinya sudah dibawa chip header dan rantai bawah. */}
      <h1 className="mb-1.5 mt-1 font-display text-[28px] font-extrabold leading-tight tracking-tight text-balance">{TEKS.judul}</h1>
      {/* Kalimat pembuka lama ("Tambahkan saham yang kamu pegang, pilih alarm
          yang aktif, lalu klik Cek sekarang") dibuang: baris petunjuk di bawah
          mengatakan persis hal yang sama di langkah 1 dan 2. Yang disisakan di
          sini justru yang TIDAK ada di petunjuk: sumber data dan bahwa cek
          biasa tidak memakai kredit. Klausa "data terkini hanya ditarik kalau
          kamu minta" juga dibuang (2026-09-19): label kotak centangnya sudah
          mengatakan itu, tepat di bawah. */}
      <p className="mb-4 max-w-[70ch] text-[13.5px] text-ink-2">
        {nyata ? (
          <>Alarm mengecek data resmi di server ini tanpa memakai <Istilah id="kredit_sectors">kredit</Istilah>.</>
        ) : (
          <>
            Server ini belum terhubung ke database Sectors, jadi alarm mengecek <b>data contoh</b> (bukan data Sectors
            nyata) tanpa memakai <Istilah id="kredit_sectors">kredit</Istilah>.
          </>
        )}
      </p>
      <PetunjukLayar
        langkah={[
          "Tambahkan saham yang dipantau (kode 4 huruf).",
          <Fragment key="cek">
            Klik <strong>Cek sekarang</strong>: hijau aman, kuning satu tanda, merah alarm berbunyi.
          </Fragment>,
          "Baca pesan penjelasannya: syarat mana, tanggalnya, dan sumbernya.",
        ]}
      />

      {/* Status bot dibaca dari env di server pada setiap permintaan; hanya
          boolean-nya yang sampai ke browser (tiket 25). Saran ketik kotak kode
          juga datang dari server, sejumlah emiten yang benar-benar ada. */}
      <PanelPasang telegramAktif={botAktif()} opsi={opsi} />
      <NavigasiLangkah sekarang="/pasang" />
    </main>
  );
}
