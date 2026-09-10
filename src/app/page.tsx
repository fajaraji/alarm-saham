import type { Metadata } from "next";
import Link from "next/link";

import { sumberSitus } from "@/lib/sumber-situs";

export const metadata: Metadata = {
  title: "Alarm Saham",
  description: "Putar ulang tanda resmi sebuah saham, rakit alarmmu sendiri dan uji ke masa lalu, lalu pasang untuk portofoliomu.",
};

function langkah(nyata: boolean) {
  return [
    {
      n: "1",
      href: "/putar-ulang",
      judul: "Putar ulang",
      isi: "Lihat rekaman tanda resmi bursa untuk satu saham — suspensi, laporan yang berhenti, ekuitas negatif, rights issue — dengan slider waktu.",
    },
    {
      n: "2",
      href: "/rakit",
      judul: "Rakit alarm",
      isi: nyata
        ? "Susun alarmmu dari blok syarat, lalu uji ke masa lalu pada emiten nyata: berapa yang tertangkap, berapa bulan lebih awal, berapa alarm palsu."
        : "Susun alarmmu dari blok syarat, lalu uji ke masa lalu pada emiten di data contoh server ini: berapa yang tertangkap, berapa bulan lebih awal, berapa alarm palsu.",
    },
    {
      n: "3",
      href: "/pasang",
      judul: "Pasang",
      isi: nyata
        ? "Pasang alarm ke saham yang kamu pegang. Setiap pagi dicek ke data resmi; hasilnya masuk kotak masuk (dan Telegram bila dihubungkan)."
        : "Pasang alarm ke saham yang kamu pegang. Setiap pagi dicek ke data yang ada di server ini — saat ini data contoh; hasilnya masuk kotak masuk (dan Telegram bila dihubungkan).",
    },
  ] as const;
}

// Beranda: mengarahkan ke tiga langkah. Header, panduan, dan footer disclaimer
// datang dari layout akar.
//
// Klaim sumber ("Semua data dari Sectors Financial API", "hanya fakta resmi
// dengan sumbernya") MENGIKUTI sumber yang benar-benar dipakai server: di jalur
// data contoh beranda dulu tetap mengklaim data Sectors.
export default async function Beranda() {
  const { nyata } = await sumberSitus();
  const LANGKAH = langkah(nyata);
  return (
    <main className="mx-auto w-full max-w-[1200px] flex-1 px-6 pb-16 pt-10">
      <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-ink-3">Alarm saham yang bisa kamu rakit sendiri</p>
      <h1 className="mb-3 mt-1 max-w-[22ch] font-display text-[34px] font-extrabold leading-tight tracking-tight text-balance">
        Tanda bahayanya sudah diterbitkan bursa. Alarm Saham membuatnya terbaca.
      </h1>
      <p className="mb-8 max-w-[68ch] text-[15px] text-ink-2">
        Suspensi, laporan kuartal yang berhenti, ekuitas negatif, dan rights issue dipublikasikan resmi jauh sebelum sebuah saham
        dihapus dari bursa. Di sini kamu bisa memutar ulang tanda itu, merakit alarmmu sendiri, mengujinya ke kasus nyata di
        masa lalu, lalu memasangnya untuk portofoliomu.{" "}
        {nyata ? (
          <>Semua data dari Sectors Financial API.</>
        ) : (
          <>
            Server ini <b>belum terhubung ke database Sectors</b>, jadi yang tampil adalah data contoh (bukan data Sectors
            nyata) untuk mendemokan cara kerjanya.
          </>
        )}
      </p>

      <ol className="mb-8 grid gap-4 md:grid-cols-3" aria-label="Tiga langkah">
        {LANGKAH.map((l) => (
          <li key={l.n} className="rounded-[14px] border border-line bg-surface p-5 shadow-panel">
            <span
              aria-hidden="true"
              className="mb-3 grid h-9 w-9 place-items-center rounded-full bg-accent font-display text-lg font-extrabold text-accent-ink"
            >
              {l.n}
            </span>
            <h2 className="mb-1 font-display text-[18px] font-bold">
              <Link href={l.href} className="text-ink no-underline hover:underline">
                {l.judul}
              </Link>
            </h2>
            <p className="text-[13.5px] text-ink-2">{l.isi}</p>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/putar-ulang"
          className="rounded-lg bg-accent px-4 py-2.5 text-[14px] font-semibold text-accent-ink no-underline hover:opacity-90"
        >
          Mulai dari langkah 1 →
        </Link>
        <Link href="/cara-kami-menghitung" className="text-[13.5px] font-semibold text-accent underline">
          Cara kami menghitung
        </Link>
        <Link href="/kamus" className="text-[13.5px] font-semibold text-accent underline">
          Kamus istilah
        </Link>
      </div>

      {/* Kalimat disclaimer wajib datang dari footer layout akar (FooterDisclaimer);
          halaman tidak memasangnya sendiri agar tidak tampil dua kali di satu layar. */}
      <p className="mt-8 max-w-[68ch] rounded-lg bg-warn-soft px-4 py-3 text-[12.5px] text-ink-2">
        <strong className="text-ink">Batasnya jelas.</strong> Tidak ada eksekusi transaksi, tidak ada anjuran, dan tidak ada
        penilaian tentang emiten mana pun —{" "}
        {nyata ? <>hanya fakta resmi dengan sumbernya.</> : <>hanya data contoh berlabel, lengkap dengan sumbernya.</>}
      </p>
    </main>
  );
}
