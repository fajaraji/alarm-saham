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
        {sumberNyata ? (
          <>
            Semua kejadian yang tampil adalah fakta resmi dari feed Sectors (data BEI) dengan nama endpoint dan tautan
            dokumen bila tersedia; tidak ada penilaian tentang emiten mana pun. Data laporan dan keuangan tersedia sejak
            kuartal 1 2020, filing orang dalam sejak 2024.
          </>
        ) : (
          <>
            Server ini belum terhubung ke database Sectors, jadi yang tampil adalah <b>data contoh</b> (bukan data Sectors
            nyata): bentuknya meniru feed BEI lewat Sectors, tetapi angkanya ilustratif — jangan dibaca sebagai fakta
            tentang emiten mana pun. Tidak ada penilaian tentang emiten mana pun.
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
