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
      isi: "Lihat rekaman tanda resmi bursa untuk satu saham (suspensi, laporan yang berhenti, ekuitas negatif, rights issue) dengan slider waktu.",
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
        : "Pasang alarm ke saham yang kamu pegang. Setiap pagi dicek ke data yang ada di server ini (saat ini data contoh); hasilnya masuk kotak masuk (dan Telegram bila dihubungkan).",
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
      {/* Tanpa eyebrow di sini: kalimat "alarm saham yang bisa kamu rakit
          sendiri" sudah terpampang di header pada setiap halaman, dan di beranda
          keduanya tampil berbarengan berjarak sekitar 40px. Judul di bawah
          bekerja lebih baik tanpa pengulangan itu di atasnya. */}
      <h1 className="mb-3 max-w-[22ch] font-display text-[34px] font-extrabold leading-tight tracking-tight text-balance">
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

      {/* Langkah 1 sengaja lebih berat daripada 2 dan 3: pembaca pertama kali
          butuh SATU titik masuk, bukan tiga pintu setara. Tiga kartu identik
          (ukuran, padding, lingkaran terisi yang sama) membuat ketiganya tampak
          sederajat padahal semua orang mulai dari langkah 1. Hierarkinya dibawa
          oleh lebar kolom, bidang panel, dan lingkaran terisi vs bergaris. */}
      <ol className="mb-8 grid gap-4 md:grid-cols-[1.35fr_1fr_1fr]" aria-label="Tiga langkah">
        {LANGKAH.map((l, i) => {
          const utama = i === 0;
          return (
            <li
              key={l.n}
              className={
                utama
                  ? "rounded-[14px] border border-line bg-surface p-5 shadow-panel"
                  : "rounded-[12px] border border-line p-5"
              }
            >
              <span
                aria-hidden="true"
                className={`mb-3 grid h-9 w-9 place-items-center rounded-full font-display text-lg font-extrabold ${
                  utama ? "bg-accent text-accent-ink" : "border border-line-strong text-ink-3"
                }`}
              >
                {l.n}
              </span>
              <h2 className={`mb-1 font-display font-bold ${utama ? "text-[20px]" : "text-[17px]"}`}>
                <Link href={l.href} className={`no-underline hover:underline ${utama ? "text-ink" : "text-ink-2"}`}>
                  {l.judul}
                </Link>
              </h2>
              <p className={utama ? "text-[14px] text-ink-2" : "text-[13px] text-ink-3"}>{l.isi}</p>
            </li>
          );
        })}
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
        penilaian tentang emiten mana pun:{" "}
        {nyata ? <>hanya fakta resmi dengan sumbernya.</> : <>hanya data contoh berlabel, lengkap dengan sumbernya.</>}
      </p>
    </main>
  );
}
