import type { Metadata } from "next";
import Link from "next/link";

import { LinimasaBukti } from "@/components/beranda/LinimasaBukti";
import { getEventSource } from "@/lib/engine/sumber";
import { SKOR_NYATA } from "@/lib/metodologi/skor";
import { hanyaTanda } from "@/lib/putar-ulang/kejadian";
import { muatEmitenDariSumber } from "@/lib/putar-ulang/muat";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Alarm Saham",
  description: "Putar ulang tanda resmi sebuah saham, rakit alarmmu sendiri dan uji ke masa lalu, lalu pasang untuk portofoliomu.",
};

/**
 * Kandidat emiten untuk bukti di hero, dicoba berurutan.
 *
 * Daftar, bukan satu kode yang dipaku, karena hero ini HANYA boleh tampil bila
 * datanya benar-benar ada di server yang sedang jalan: jalur data contoh hanya
 * punya 8 emiten, dan satu kode yang dipaku akan membuat hero kosong di sana.
 *
 * Percobaan pertama saya memakai SRIL dan itu salah, dengan cara yang menarik:
 * seluruh barisan suspensi SRIL bertanggal SAMA dengan hari kejadiannya, jadi
 * "tanda yang sudah terbit sebelum kejadian" benar-benar nol (terukur). SRIL
 * justru kasus yang kami akui terlewat di /cara-kami-menghitung. Hero yang
 * menjanjikan "tandanya sudah terbit lebih dulu" karena itu tidak boleh
 * memakainya.
 *
 * TELE didahulukan karena ceritanya lengkap dan seluruhnya di dalam jangkauan
 * data: ekuitas negatif 2024-09-30, suspensi 2024-12-27, ekuitas negatif lagi
 * dua kuartal berikutnya, lalu dihapus dari bursa 2025-06-06.
 */
const KANDIDAT_BUKTI = ["TELE", "LMAS", "SBAT", "DUCK"] as const;

/** Berapa baris tanda yang ditampilkan di hero. Lebih dari ini jadi tabel, bukan hero. */
const MAKS_BARIS = 4;

/** Bukti hanya dipakai bila tandanya benar-benar lebih dari satu; satu baris bukan pola. */
const MIN_TANDA = 2;

function bulanAntara(dari: string, sampai: string): number | null {
  const a = new Date(`${dari}T00:00:00Z`);
  const b = new Date(`${sampai}T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
}

async function buktiHero(contoh: boolean) {
  try {
    const sumber = await getEventSource();
    for (const kode of KANDIDAT_BUKTI) {
      const emiten = await muatEmitenDariSumber(sumber, kode);
      // "tidak_ada" = nol baris di data server ini. Status lain tetap dipakai:
      // walau endpoint `dates` sebuah emiten 404, feed suspensinya masih
      // memberi tanda yang sah untuk ditampilkan.
      if (emiten.status === "tidak_ada" || !emiten.targetEventDate) continue;
      const target = emiten.targetEventDate;
      // Hanya tanda yang SUDAH jadi fakta sebelum tanggal kejadian. Klaim
      // "tandanya terbit lebih dulu" tidak boleh dibangun dari baris yang
      // justru muncul sesudah kejadiannya.
      const semua = hanyaTanda(emiten.kejadian).filter((k) => k.date < target);
      if (semua.length < MIN_TANDA) continue;
      const tanda = semua.slice(-MAKS_BARIS);
      return {
        symbol: emiten.symbol,
        namaEmiten: emiten.companyName,
        tanda,
        tanggalKejadian: target,
        // Dihitung dari tanda PALING AWAL yang benar-benar ada, bukan dari
        // baris yang kebetulan tampil setelah dipotong MAKS_BARIS.
        bulanLebihAwal: bulanAntara(semua[0].date, target),
        contoh,
      };
    }
    return null;
  } catch {
    // Hero tanpa bukti lebih baik daripada hero berisi angka karangan.
    return null;
  }
}

/**
 * Beranda: hero belah asimetris (kiri pesan, kanan bukti data nyata), lalu
 * satu baris angka terukur, lalu tiga langkah dalam bentuk 1+2, lalu pita
 * batas. Empat bagian, empat keluarga tata letak berbeda.
 *
 * Yang DIBUANG dari versi sebelumnya, dan alasannya:
 * - Tiga kartu seukuran bersebelahan. taste-skill Section 9.C melarangnya
 *   terang-terangan ("NO 3-column equal feature cards"), dan itu justru
 *   satu-satunya struktur yang dimiliki beranda lama.
 * - Paragraf hero 45 kata. Section 4.7 membatasi subteks hero maksimal 20 kata
 *   dan judul maksimal 2 baris; versi lama tiga baris judul + empat baris
 *   paragraf abu-abu.
 * - Nol bukti produk. Section 4.8: hero butuh visual nyata, dan aturan yang
 *   sama mengizinkan pratayang komponen sungguhan sebagai penggantinya.
 *
 * Dial: DESIGN_VARIANCE 7, MOTION_INTENSITY 4 (transisi CSS saja, tanpa library),
 * VISUAL_DENSITY 6 (angka mono, garis 1px, kotak kartu dikurangi). Tema tetap
 * mengikuti prefers-color-scheme seperti seluruh aplikasi (Section 4.11 Theme
 * Lock: satu tema untuk satu halaman, dan "auto" adalah pilihan yang sah).
 */
export default async function Beranda() {
  const sumber = await getEventSource();
  const contoh = sumber.jenis === "fixture";
  const bukti = await buktiHero(contoh);
  const skor = SKOR_NYATA;

  return (
    <main className="mx-auto w-full max-w-[1200px] flex-1 px-6 pb-16">
      {/* ---------- Bagian 1: hero belah asimetris ---------- */}
      <section className="grid items-start gap-8 pt-10 md:grid-cols-[5fr_6fr] md:gap-10 lg:pt-16">
        <div>
          {/* Skala dan lebar dipasang BERSAMA, seperti yang dituntut Section 4.7.
              Versi pertama saya memakai `max-w-[18ch]` tanpa syarat, dan di layar
              375px batas itu justru LEBIH SEMPIT daripada ruang yang tersedia,
              sehingga judulnya pecah jadi 4 baris (terukur). Di ponsel lebarnya
              dilepas dan skalanya diturunkan; batas 18ch baru berlaku dari `md`
              ke atas, tempat ia memang berguna menjaga panjang baris. */}
          <h1 className="m-0 font-display text-[27px] font-extrabold leading-[1.08] tracking-tight text-balance sm:text-[32px] md:max-w-[24ch] md:text-[40px]">
            Tanda bahayanya sudah terbit. Kami membacanya.
          </h1>
          <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-ink-2">
            Suspensi, laporan yang berhenti, ekuitas negatif. Semuanya diterbitkan resmi sebelum sebuah saham dihapus dari
            bursa.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link
              href="/putar-ulang"
              className="rounded-lg bg-accent px-5 py-3 text-[14px] font-semibold text-accent-ink no-underline transition-transform hover:opacity-90 active:translate-y-px"
            >
              Mulai dari langkah 1
            </Link>
            <Link href="/cara-kami-menghitung" className="text-[13.5px] font-semibold text-accent underline">
              Cara kami menghitung
            </Link>
          </div>
        </div>

        {bukti ? (
          <LinimasaBukti {...bukti} />
        ) : (
          /* Keadaan kosong yang jujur: kalau data buktinya tidak ada di server
             ini, hero tidak mengarang linimasa. */
          <p className="rounded-xl border border-line bg-surface px-4 py-3 text-[13px] text-ink-2">
            Server ini belum punya data contoh rekaman yang bisa ditampilkan di sini.{" "}
            <Link href="/putar-ulang" className="font-semibold text-accent underline">
              Cari saham lain di langkah 1
            </Link>
            .
          </p>
        )}
      </section>

      {/* ---------- Bagian 2: satu baris angka terukur ---------- */}
      <section aria-labelledby="angka" className="mt-14 border-t border-line pt-6">
        <h2 id="angka" className="sr-only">
          Hasil uji ke masa lalu
        </h2>
        <dl className="m-0 grid gap-x-8 gap-y-5 sm:grid-cols-3">
          <div>
            <dd className="m-0 font-display text-[30px] font-extrabold leading-none tabular-nums text-ink">
              {skor.perGroup.delisting.hits}/{skor.perGroup.delisting.total}
            </dd>
            <dt className="mt-1.5 text-[13px] text-ink-2">saham dihapus dari bursa yang alarmnya berbunyi lebih dulu</dt>
          </div>
          <div>
            <dd className="m-0 font-display text-[30px] font-extrabold leading-none tabular-nums text-ink">
              {Math.round(skor.leadMonthsAvg ?? 0)} bln
            </dd>
            <dt className="mt-1.5 text-[13px] text-ink-2">rata-rata jarak bunyi pertama ke hari kejadian</dt>
          </div>
          <div>
            <dd className="m-0 font-display text-[30px] font-extrabold leading-none tabular-nums text-ink">
              {skor.falseAlarms}/{skor.controls}
            </dd>
            <dt className="mt-1.5 text-[13px] text-ink-2">saham sehat yang alarmnya ikut berbunyi</dt>
          </div>
        </dl>
        <p className="mt-5 text-[12.5px] text-ink-3">
          Snapshot {skor.today} dari aturan bawaan, dihitung ulang setiap kali tesnya berjalan.{" "}
          <Link href="/cara-kami-menghitung" className="font-semibold text-accent underline">
            Cara angka ini dihitung
          </Link>
          .
        </p>
      </section>

      {/* ---------- Bagian 3: tiga langkah, 1 besar + 2 bertumpuk ----------
          Tepat tiga sel untuk tiga isi, tanpa sel kosong (Section 4.7 Bento
          Cell Count). Langkah 1 dominan karena semua orang mulai dari sana. */}
      <section aria-labelledby="langkah" className="mt-14">
        <h2 id="langkah" className="m-0 font-display text-[22px] font-bold">
          Tiga langkah, dan kamu yang menentukan aturannya
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-[1.25fr_1fr]">
          {/* Isi dirapatkan ke atas, TIDAK `justify-between`: kartu ini setinggi
              dua kartu di kanannya, dan menjauhkan judul dari keterangannya
              meninggalkan lubang kosong di tengah yang terbaca sebagai cacat
              tata letak, bukan sebagai ruang yang disengaja. */}
          <Link
            href="/putar-ulang"
            className="group rounded-xl border border-line bg-surface-2 p-6 no-underline transition-colors hover:border-accent"
          >
            <span className="block font-display text-[21px] font-bold text-ink group-hover:text-accent">
              Putar ulang satu saham
            </span>
            <span className="mt-2.5 block max-w-[40ch] text-[14.5px] leading-relaxed text-ink-2">
              Geser waktu ke belakang dan lihat tanda apa yang sudah terbit pada tanggal itu, lengkap dengan sumbernya.
            </span>
          </Link>
          <div className="grid gap-4">
            <Link
              href="/rakit"
              className="group rounded-xl border border-line p-5 no-underline transition-colors hover:border-accent"
            >
              <span className="font-display text-[17px] font-bold text-ink group-hover:text-accent">Rakit alarmmu</span>
              <span className="mt-1.5 block text-[13px] leading-relaxed text-ink-2">
                Susun syarat dari blok, lalu uji ke emiten yang benar-benar pernah dihapus dari bursa.
              </span>
            </Link>
            <Link
              href="/pasang"
              className="group rounded-xl border border-line p-5 no-underline transition-colors hover:border-accent"
            >
              <span className="font-display text-[17px] font-bold text-ink group-hover:text-accent">Pasang dan tunggu</span>
              {/* Klaim sumber WAJIB mengikuti sumber yang benar-benar dipakai
                  server. Versi pertama saya menulis "dicek ke data resmi" tanpa
                  syarat, dan gerbang e2e jalur data contoh langsung merah:
                  di sana yang diperiksa data contoh, bukan data resmi. Itu
                  persis cacat aturan lomba (d) yang ditutup tiket 15. */}
              <span className="mt-1.5 block text-[13px] leading-relaxed text-ink-2">
                Setiap pagi alarmmu dicek ulang ke {contoh ? "data yang ada di server ini" : "data resmi"}. Yang berubah
                masuk kotak masuk.
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Bagian 4: pita batas, selebar halaman ---------- */}
      <section aria-labelledby="batas" className="mt-14 rounded-xl bg-warn-soft px-6 py-5">
        <h2 id="batas" className="m-0 font-display text-[17px] font-bold text-ink">
          Batasnya jelas
        </h2>
        <p className="m-0 mt-2 max-w-[72ch] text-[13.5px] leading-relaxed text-ink-2">
          Tidak ada eksekusi transaksi, tidak ada anjuran, dan tidak ada penilaian tentang emiten mana pun.{" "}
          {contoh ? (
            <>Server ini memakai data contoh berlabel, lengkap dengan sumbernya.</>
          ) : (
            <>Yang ada hanya fakta resmi dengan tanggal dan sumbernya.</>
          )}{" "}
          <Link href="/kamus" className="font-semibold text-accent underline">
            Kamus istilah
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
