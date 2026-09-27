import type { Metadata } from "next";
import Link from "next/link";

import { LinimasaBukti } from "@/components/beranda/LinimasaBukti";
import { getEventSource, type SumberKejadian } from "@/lib/engine/sumber";
import { SKOR_NYATA } from "@/lib/metodologi/skor";
import { daftarBisaDicari } from "@/lib/putar-ulang/daftar-cari";
import { hanyaTanda, type Kejadian } from "@/lib/putar-ulang/kejadian";
import { muatEmitenDariSumber } from "@/lib/putar-ulang/muat";
import { fmtTanggal } from "@/lib/putar-ulang/ringkas";
import { EMITEN_DELISTING, TANGGAL_EFEKTIF_DELISTING, type EmitenDelisting } from "@/lib/universe/daftar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Alarm Saham",
  description: "Putar ulang tanda resmi sebuah saham, rakit alarmmu sendiri dan uji ke masa lalu, lalu pasang untuk portofoliomu.",
};

/**
 * Kandidat emiten untuk contoh di bawah hero, dicoba berurutan.
 *
 * Daftar, bukan satu kode yang dipaku, karena contoh ini HANYA boleh tampil bila
 * datanya ada di server yang sedang jalan (jalur data contoh hanya punya 8
 * emiten). Semua kandidat anggota `EMITEN_DELISTING`, dan pemilihan di bawah
 * memeriksanya lagi, karena halaman ini menyebut tanggal efektif penghapusan;
 * kalimat itu hanya benar untuk emiten yang memang ada di daftar itu.
 *
 * SRIL tidak dipakai: seluruh barisan suspensinya bertanggal sama dengan hari
 * kejadiannya, jadi tanda yang tercatat SEBELUM kejadian benar-benar nol. TELE
 * dibuang (tiket 39): perdagangannya dihentikan 10 Juni 2020, jauh sebelum
 * "tanda" ekuitas negatif 30 September 2023, dan feed kami tidak memuat itu.
 */
const KANDIDAT_BUKTI = ["LMAS", "SBAT", "DUCK"] as const;

/** Berapa baris tanda yang ditampilkan. Lebih dari ini jadi tabel, bukan contoh. */
const MAKS_BARIS = 4;

/** Contoh hanya dipakai bila tandanya lebih dari satu; satu baris bukan pola. */
const MIN_TANDA = 2;

const ALASAN_DIHAPUS: Record<EmitenDelisting["alasan"], string> = {
  pailit: "karena pailit",
  "suspensi>50bln": "karena sudah disuspensi lebih dari 50 bulan",
};

interface Bukti {
  symbol: string;
  namaEmiten: string | null;
  tanda: Kejadian[];
  /** Tanggal tanda PALING AWAL yang tercatat, bukan baris pertama yang kebetulan tampil. */
  pertama: string;
  /**
   * Jumlah SELURUH tanda sebelum tanggal kejadian, bukan hanya yang tampil.
   * Tanpa angka ini kalimat "yang paling awal pada 30 Sep 2023" bertabrakan
   * dengan linimasa yang mulai dari 2024 (yang tampil hanya MAKS_BARIS terakhir).
   */
  jumlah: number;
  alasan: EmitenDelisting["alasan"];
}

async function cariBukti(sumber: SumberKejadian): Promise<Bukti | null> {
  try {
    for (const kode of KANDIDAT_BUKTI) {
      const delisting = EMITEN_DELISTING.find((e) => e.symbol === kode);
      if (!delisting) continue;
      const emiten = await muatEmitenDariSumber(sumber, kode);
      if (emiten.status === "tidak_ada" || emiten.group !== "delisting" || !emiten.targetEventDate) continue;
      const target = emiten.targetEventDate;
      // Hanya tanda yang sudah jadi fakta sebelum tanggal kejadian target.
      const semua = hanyaTanda(emiten.kejadian).filter((k) => k.date < target);
      if (semua.length < MIN_TANDA) continue;
      return {
        symbol: emiten.symbol,
        namaEmiten: emiten.companyName,
        tanda: semua.slice(-MAKS_BARIS),
        pertama: semua[0].date,
        jumlah: semua.length,
        alasan: delisting.alasan,
      };
    }
    return null;
  } catch {
    // Tanpa contoh lebih baik daripada contoh berisi data karangan.
    return null;
  }
}

/**
 * Beranda, opsi B yang dipilih pemilik (2026-09-14): hero = kotak cari saham
 * milik pengguna; contoh nyata dipindah ke bawahnya dengan penjelasan lengkap.
 *
 * Kenapa contoh TELE tidak lagi jadi hero: pemilik membacanya sebagai data basi
 * ("ini 2026, kok tanggalnya 2024") dan tidak paham kenapa satu kode saham
 * tiba-tiba muncul. Dua keberatan itu benar. Hero lama tidak menyebut bahwa ini
 * contoh, tidak menyebut bahwa TELE akan dihapus dari bursa efektif 10 November
 * 2026, dan pita tanggalnya keliru. Orang datang ke sini untuk saham MILIKNYA,
 * jadi itu yang sekarang pertama.
 *
 * Tautan "Mulai dari langkah 1" di hero juga dibuang: kotak cari membawa ke
 * /putar-ulang juga, dan dua CTA dengan niat yang sama di satu halaman adalah
 * kegagalan pre-flight taste-skill (Section 4.5).
 *
 * Susunan (tiket 44): hero kotak cari → ajakan pasang (intinya: dijaga tiap
 * pagi tanpa membuka apa pun) → contoh nyata (belah teks + linimasa) → "Lihat
 * buktinya" (angka uji + putar ulang + rakit) → pita batas. Rakit dan uji ke
 * masa lalu sengaja turun ke bawah: keduanya fitur pengguna mahir dan bukti
 * bagi juri, bukan alasan orang awam datang ke sini.
 */
export default async function Beranda() {
  const sumber = await getEventSource();
  const contoh = sumber.jenis === "fixture";
  const universe = await sumber.universe();
  const [opsi, bukti] = await Promise.all([daftarBisaDicari(sumber.db, universe), cariBukti(sumber)]);
  const skor = SKOR_NYATA;

  return (
    <main className="mx-auto w-full max-w-[1200px] flex-1 px-6 pb-16">
      {/* ---------- Bagian 1: hero, kotak cari saham milik pengguna ---------- */}
      <section className="pt-10 lg:pt-16">
        <h1 className="m-0 font-display text-[27px] font-extrabold leading-[1.08] tracking-tight text-balance sm:text-[32px] md:max-w-[22ch] md:text-[40px]">
          Cek tanda bahaya resmi pada saham milikmu.
        </h1>
        <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink-2">
          Suspensi, laporan yang berhenti, utang lebih besar dari harta. Lihat yang sudah tercatat untuk sahammu, lengkap
          dengan tanggal dan sumbernya.
        </p>

        {/* Form GET biasa: bekerja tanpa JavaScript. Label DI ATAS input, bukan
            placeholder sebagai label (taste-skill Section 4.6). Saran ketik lewat
            <datalist> bawaan peramban, dari daftar emiten yang benar-benar ada
            di server ini, jadi jumlahnya tidak pernah dipaku. */}
        <form
          action="/putar-ulang"
          method="get"
          role="search"
          aria-label="Cek saham milikmu"
          className="mt-7 max-w-[560px]"
        >
          <label htmlFor="kode-beranda" className="block text-[13px] font-semibold text-ink">
            Kode saham
          </label>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <input
              id="kode-beranda"
              name="kode"
              list="saran-beranda"
              required
              maxLength={5}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="mis. BBCA"
              className="min-h-[46px] w-full rounded-lg border border-line-strong bg-surface px-3.5 font-mono text-[15px] text-ink placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            <button
              type="submit"
              className="min-h-[46px] shrink-0 rounded-lg bg-accent px-5 text-[14px] font-semibold text-accent-ink transition-transform hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:translate-y-px"
            >
              Lihat tandanya
            </button>
          </div>
          <datalist id="saran-beranda">
            {opsi.map((o) => (
              <option key={o.symbol} value={o.symbol}>
                {o.nama ?? o.symbol}
              </option>
            ))}
          </datalist>
          <p className="m-0 mt-2 text-[12.5px] text-ink-3">
            Ketik lalu pilih dari saran. Bisa dicari: {opsi.length} emiten. Di Telegram, ketik{" "}
            <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[12px] text-ink-2">/cek BBCA</code> ke bot kami.
          </p>
        </form>
      </section>

      {/* ---------- Bagian 2: pasang dan dijaga, inti produk (tiket 44) ----------
          Dulu bagian ini ada di paling bawah sebagai kartu ketiga dari "tiga
          langkah". Yang dicari orang justru ini: dijaga tanpa harus membuka
          apa pun. Rakit dan angka uji turun ke bagian "Lihat buktinya". */}
      <section aria-labelledby="jaga" className="mt-14 rounded-xl border border-line bg-surface-2 p-6">
        <h2 id="jaga" className="m-0 font-display text-[22px] font-bold">
          Lalu biarkan kami yang menjaganya
        </h2>
        <p className="mt-2.5 max-w-[58ch] text-[14.5px] leading-relaxed text-ink-2">
          Simpan saham yang kamu pegang, dan setiap pagi kami cek ulang ke {contoh ? "data yang ada di server ini" : "data resmi"}.
          Yang berubah dikirim ke kotak masuk dan ke Telegram, jadi kamu tidak perlu membuka apa pun.
        </p>
        <Link
          href="/pasang"
          className="mt-4 inline-block rounded-lg bg-accent px-5 py-2.5 text-[14px] font-semibold text-accent-ink no-underline transition-transform hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:translate-y-px"
        >
          Pasang alarm untuk sahammu
        </Link>
      </section>

      {/* ---------- Bagian 2: satu contoh, dengan penjelasan lengkap ---------- */}
      {bukti ? (
        <section aria-labelledby="contoh" className="mt-16 grid items-start gap-8 md:grid-cols-[5fr_6fr] md:gap-10">
          <div>
            {/* "Contoh nyata" hanya di jalur database: di jalur data contoh baris
                tandanya ilustratif, jadi menyebutnya nyata akan menyesatkan. */}
            <h2 id="contoh" className="m-0 font-display text-[22px] font-bold">
              {contoh ? `Contoh: ${bukti.symbol}` : `Contoh nyata: ${bukti.symbol}`}
            </h2>
            <p className="mt-3 max-w-[46ch] text-[14.5px] leading-relaxed text-ink-2">
              {bukti.namaEmiten ?? bukti.symbol} akan dihapus dari bursa efektif{" "}
              <b className="font-semibold text-ink">{fmtTanggal(TANGGAL_EFEKTIF_DELISTING)}</b> {ALASAN_DIHAPUS[bukti.alasan]}.
            </p>
            <p className="mt-3 max-w-[46ch] text-[14.5px] leading-relaxed text-ink-2">
              {contoh ? (
                <>Baris linimasa ini berasal dari data contoh server ini, untuk memperlihatkan cara kerjanya.</>
              ) : (
                <>
                  {/* "Setidaknya": yang dihitung hanya tanda sebelum tanggal kejadian target. Arah
                      "di sebelah" tidak dipakai, karena di ponsel linimasanya ada di bawah. */}
                  Setidaknya <b className="font-semibold text-ink">{bukti.jumlah}</b> tanda sudah tercatat jauh sebelum
                  tanggal itu. Yang paling awal pada <b className="font-semibold text-ink">{fmtTanggal(bukti.pertama)}</b>.
                  Linimasa ini menampilkan {bukti.tanda.length} yang terakhir.
                </>
              )}
            </p>
            <p className="mt-3 max-w-[46ch] text-[14.5px] leading-relaxed text-ink-2">
              Tanda seperti ini yang bisa kamu jadikan alarm, lalu kamu pasang pada sahammu.
            </p>
          </div>
          <LinimasaBukti symbol={bukti.symbol} namaEmiten={bukti.namaEmiten} tanda={bukti.tanda} contoh={contoh} />
        </section>
      ) : null}

      {/* ---------- Bagian 4: lihat buktinya (angka + rakit sendiri) ---------- */}
      <section aria-labelledby="angka" className="mt-16 border-t border-line pt-6">
        <h2 id="angka" className="m-0 font-display text-[22px] font-bold">
          Lihat buktinya
        </h2>
        <p className="mt-2 max-w-[58ch] text-[14.5px] leading-relaxed text-ink-2">
          Aturan bawaan diuji ke saham yang benar-benar bermasalah, diukur sampai hari sahamnya berhenti diperdagangkan.
          Sesudah hari itu sahamnya tidak bisa dilepas lagi, jadi tanda yang datang belakangan tidak dihitung.
        </p>
        <dl className="m-0 mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-3">
          <div>
            <dd className="m-0 font-display text-[30px] font-extrabold leading-none tabular-nums text-ink">
              {skor.hits}/{skor.total}
            </dd>
            <dt className="mt-1.5 text-[13px] text-ink-2">saham bermasalah yang tandanya terbit lebih dulu</dt>
          </div>
          <div>
            <dd className="m-0 font-display text-[30px] font-extrabold leading-none tabular-nums text-ink">
              {skor.leadMonthsMedian ?? 0} bln
            </dd>
            <dt className="mt-1.5 text-[13px] text-ink-2">
              jarak khas tanda pertama ke hari saham berhenti diperdagangkan
            </dt>
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
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Link
            href="/putar-ulang"
            className="group rounded-xl border border-line p-5 no-underline transition-colors hover:border-accent"
          >
            <span className="font-display text-[17px] font-bold text-ink group-hover:text-accent">
              Putar ulang satu saham
            </span>
            <span className="mt-1.5 block text-[13px] leading-relaxed text-ink-2">
              Geser waktu ke belakang dan lihat tanda apa yang sudah terbit pada tanggal itu, lengkap dengan sumbernya.
            </span>
          </Link>
          <Link
            href="/rakit"
            className="group rounded-xl border border-line p-5 no-underline transition-colors hover:border-accent"
          >
            <span className="font-display text-[17px] font-bold text-ink group-hover:text-accent">
              Rakit aturanmu sendiri
            </span>
            <span className="mt-1.5 block text-[13px] leading-relaxed text-ink-2">
              Susun syarat dari blok, lalu uji sendiri ke saham yang benar-benar pernah dihapus dari bursa.
            </span>
          </Link>
        </div>
      </section>

      {/* ---------- Bagian 5: pita batas, selebar halaman ---------- */}
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
