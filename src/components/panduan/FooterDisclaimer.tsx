// Footer disclaimer (PLAN.md §2) — dipasang sekali di layout akar sehingga ada
// di SEMUA halaman. Halaman tidak boleh memasang footer disclaimer sendiri.
//
// Kalimat sumber MENGIKUTI sumber data yang benar-benar dipakai server. Dulu ia
// selalu berbunyi "fakta resmi dari feed Sectors", termasuk pada jalur data
// contoh — sehingga di layar yang sama lede halaman mengaku data contoh
// sementara footer di bawahnya membantahnya. `data-sumber` adalah penanda mesin
// untuk gerbang e2e (teks "bukan data Sectors nyata" memuat substring "data
// Sectors nyata", jadi teks saja tidak bisa dijadikan assertion).
import Link from "next/link";

import { DISCLAIMER } from "./kamus";

export interface PropsFooterDisclaimer {
  /** true = database berisi data Sectors nyata; false = fixture data contoh. */
  sumberNyata: boolean;
}

export function FooterDisclaimer({ sumberNyata }: PropsFooterDisclaimer) {
  return (
    <footer
      className="mt-auto border-t border-line bg-surface"
      data-testid="disclaimer"
      data-sumber={sumberNyata ? "db" : "fixture"}
    >
      <p className="mx-auto max-w-[1200px] px-6 py-4 text-center text-xs text-ink-3">
        <strong className="text-ink-2">{DISCLAIMER}</strong>{" "}
        {/* Footer ini tampil di SETIAP halaman, jadi setiap kata di sini dibayar
            enam kali. Kalimat cakupan tanggal ("data laporan sejak kuartal 1
            2020, filing sejak 2024") dibuang dari sini: ia rincian yang sudah
            ditulis lengkap di /cara-kami-menghitung, yang tautannya justru ada
            di baris ini. Kalimat DISCLAIMER wajib dan klausa "tidak ada
            penilaian" tetap, karena itu syarat aturan lomba, bukan hiasan.
            Jalur data contoh dulu menutup dengan dua kalimat yang sama-sama
            berakhir "emiten mana pun"; keduanya digabung. */}
        {sumberNyata ? (
          <>
            Semua kejadian yang tampil adalah fakta resmi dari feed Sectors (data BEI) dengan nama endpoint dan tautan
            dokumen bila tersedia; tidak ada penilaian tentang emiten mana pun.
          </>
        ) : (
          <>
            Server ini belum terhubung ke database Sectors, jadi yang tampil adalah <b>data contoh</b> (bukan data Sectors
            nyata): bentuknya meniru feed BEI lewat Sectors, tetapi angkanya ilustratif dan tidak boleh dibaca sebagai
            fakta atau penilaian tentang emiten mana pun.
          </>
        )}{" "}
        <Link href="/cara-kami-menghitung" className="underline">
          Cara kami menghitung
        </Link>{" "}
        ·{" "}
        <Link href="/kamus" className="underline">
          Kamus istilah
        </Link>
      </p>
    </footer>
  );
}
