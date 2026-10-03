// Layout segmen /putar-ulang: token CSS mandiri di bawah .pu (termasuk alias
// font; lihat putar-ulang.css). Header, overlay panduan, dan footer disclaimer
// datang dari layout akar (tiket 13) — tidak dipasang lagi di sini.
//
// Sejak audit-003 (2026-10-02) segmen ini TIDAK lagi memuat hurufnya sendiri.
// Dulu ia memakai `next/font/google` (Bricolage + Plex) sementara layout akar
// sudah pindah ke berkas lokal justru karena build pernah gagal oleh gangguan
// jaringan sesaat ke fonts.gstatic.com (CI run 36595679661 pada commit yang
// lulus dua kali sebelumnya). Berkas lokalnya sama persis dengan milik akar,
// jadi muatan kedua ini hanya menduplikasi huruf DAN menanggung risiko build
// yang sudah dihapus dari rute lain. Sekarang .pu memakai variabel font akar
// (--font-bricolage / --font-plex-sans / --font-plex-mono) lewat alias di
// putar-ulang.css: satu muatan, nol perubahan visual.
import type { Metadata } from "next";

import "@/components/putar-ulang/putar-ulang.css";

export const metadata: Metadata = {
  title: "Putar ulang · Alarm Saham",
  description:
    "Lihat rekaman tanda resmi (suspensi, laporan hilang, ekuitas negatif) sebelum sebuah saham dihapus dari bursa atau berpotensi delisting.",
};

export default function PutarUlangLayout({ children }: LayoutProps<"/putar-ulang">) {
  return (
    <div className="pu">
      <main id="konten" className="pu-main">{children}</main>
    </div>
  );
}
