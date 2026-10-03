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
  description: "Putar ulang tanda resmi sebuah saham, rakit alarm dari blok syarat dan uji ke masa lalu, lalu pasang untuk memantau portofolio.",
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
    <main id="konten" className="mx-auto w-full max-w-[1600px] flex-1 px-6 pb-16">
      {/* ---------- Bagian 1: hero, kotak cari saham milik pengguna ---------- */}
      {/* Hero ini SENGAJA tetap gelap di KEDUA tema, mengikuti spec ("Hero
          Section": halaman berpindah dari hero gelap ke bagian terang).
          Alih-alih memaku warna gelap satu per satu di JSX, kelas `gelap`
          menimpa token di subtree-nya (globals.css), jadi isinya tetap memakai
          token semantik yang sama: text-ink, text-ink-2, bg-surface, .kaca.
          Kontras pasangannya karena itu sama dengan tema gelap, yang sudah
          dijaga gerbang axe.

          Yang TIDAK berubah dari keputusan pemilik 2026-09-14: yang pertama
          terbaca tetap kotak cari saham MILIK pengguna, bukan data contoh.
          Hero lama dibuang karena tanggalnya basi dan tidak menyebut dirinya
          contoh; hero ini mempertahankan susunan itu, hanya bentuknya yang
          berubah.

          `overflow-hidden` wajib: teks raksasa di bawah lebarnya 22vw x 5 huruf,
          dan tanpa itu halaman bisa digulir mendatar di lebar ponsel. */}
      <section className="gelap masuk butir relative mt-2 overflow-hidden rounded-bagian bg-bg px-6 py-12 sm:px-10 lg:min-h-[92vh] lg:px-14 lg:py-16">
        {/* Lapisan hiasan: teks raksasa + gradien bawah. Keduanya aria-hidden
            karena tidak membawa informasi; spec memakai keduanya sebagai
            kedalaman, bukan sebagai isi. Gradien bawah wajib menurut spec
            ("jangan pakai warna rata untuk latar gelap, selalu beri gradien
            yang berat di bawah") supaya tidak ada banding di bidang hitam. */}
        <span
          aria-hidden="true"
          className="teks-raksasa pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-ink"
        >
          ALARM
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-b from-transparent to-black/70"
        />

        <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            {/* Dua suntingan salinan dari audit-003 (disetujui pemilik 2026-10-02):
                kata "sudah" dibuang supaya subteks tepat 20 kata (DESIGN.md butir 5),
                dan "emiten yang dipantau" menjadi "saham yang dipegang" supaya "pantau"
                tidak muncul dua kali dalam satu H1. Isinya tidak berubah. */}
            <h1 className="m-0 font-display text-[30px] font-semibold tracking-tight text-balance sm:text-[38px] md:max-w-[22ch] md:text-[46px]">
              Pantau sinyal risiko resmi pada saham yang dipegang.
            </h1>
            <p className="mt-4 max-w-[52ch] text-[15px] font-light leading-relaxed text-ink-2">
              Suspensi, laporan yang berhenti, utang lebih besar dari harta. Semua yang tercatat untuk satu emiten,
              lengkap dengan tanggal dan sumbernya.
            </p>

            {/* Form GET biasa: bekerja tanpa JavaScript. Label DI ATAS input, bukan
                placeholder sebagai label (taste-skill Section 4.6). Saran ketik lewat
                <datalist> bawaan peramban, dari daftar emiten yang benar-benar ada
                di server ini, jadi jumlahnya tidak pernah dipaku.

                Tombolnya bentuk pil dengan lingkaran ikon di dalamnya (spec
                "Interactive Action Button"). Warnanya dipaku putih/zinc, bukan
                token tema, karena hero ini dijamin gelap di kedua tema sehingga
                putih adalah kontras tertinggi yang tersedia; memakai token
                justru akan membuatnya gelap di atas gelap pada satu tema. */}
            <form
              action="/putar-ulang"
              method="get"
              role="search"
              aria-label="Cek saham yang dipantau"
              className="mt-8 max-w-[560px]"
            >
              <label htmlFor="kode-beranda" className="label-huruf block text-ink-3">
                Kode saham
              </label>
              <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
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
                  className="min-h-[46px] w-full rounded-full border border-line-strong bg-surface px-4 font-mono text-[15px] text-ink placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                />
                <button
                  type="submit"
                  className="group inline-flex min-h-[46px] shrink-0 items-center justify-center gap-3 rounded-full bg-white py-1 pl-6 pr-1 text-[14px] font-medium text-zinc-900 transition-transform duration-300 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Lihat tandanya
                  <span
                    aria-hidden="true"
                    className="grid h-9 w-9 place-items-center rounded-full bg-zinc-900 text-white transition-colors duration-300 group-hover:bg-zinc-700"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </span>
                </button>
              </div>
              <datalist id="saran-beranda">
                {opsi.map((o) => (
                  <option key={o.symbol} value={o.symbol}>
                    {o.nama ?? o.symbol}
                  </option>
                ))}
              </datalist>
              <p className="m-0 mt-2.5 text-[12.5px] text-ink-3">
                Ketik lalu pilih dari saran. Tersedia {opsi.length} emiten. Di Telegram, ketik{" "}
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[12px] text-ink-2">/cek BBCA</code> ke bot.
              </p>
            </form>
          </div>

          {/* Kartu kaca angka uji (spec "Glass Stat Card"). Ketiganya dipindah ke
              sini dari bagian "Lihat buktinya": spec menaruh angka di hero, dan
              DESIGN.md aturan 1 melarang fakta yang sama tampil dua kali di satu
              layar. `lg:sticky` tidak dipakai supaya tidak ada gerak gulir
              tambahan; spec hanya meminta tumpukan tegak di kanan. */}
          <dl
            className="m-0 grid gap-3 sm:grid-cols-3 lg:w-[184px] lg:grid-cols-1"
            style={{ animationDelay: "0.12s" }}
          >
            <div className="kaca rounded-kartu-kecil p-5">
              <dd className="m-0 font-display text-3xl font-semibold leading-none tabular-nums text-ink">
                {skor.hits}/{skor.total}
              </dd>
              <dt className="mt-2 text-[12px] leading-snug text-ink-2">
                saham bermasalah yang tandanya terbit lebih dulu
              </dt>
            </div>
            <div className="kaca rounded-kartu-kecil p-5">
              <dd className="m-0 font-display text-3xl font-semibold leading-none tabular-nums text-ink">
                {skor.leadMonthsMedian ?? 0} bln
              </dd>
              <dt className="mt-2 text-[12px] leading-snug text-ink-2">
                jarak khas tanda pertama ke hari saham berhenti diperdagangkan
              </dt>
            </div>
            <div className="kaca rounded-kartu-kecil p-5">
              <dd className="m-0 font-display text-3xl font-semibold leading-none tabular-nums text-ink">
                {skor.falseAlarms}/{skor.controls}
              </dd>
              <dt className="mt-2 text-[12px] leading-snug text-ink-2">
                saham sehat yang alarmnya ikut berbunyi
              </dt>
            </div>
          </dl>
        </div>
      </section>

      {/* ---------- Bagian 2: pasang dan dijaga, inti produk (tiket 44) ----------
          Dulu bagian ini ada di paling bawah sebagai kartu ketiga dari "tiga
          langkah". Yang dicari orang justru ini: dijaga tanpa harus membuka
          apa pun. Rakit dan angka uji turun ke bagian "Lihat buktinya". */}
      <section aria-labelledby="jaga" className="kaca masuk mt-14 rounded-kartu p-8">
        <h2 id="jaga" className="m-0 font-display text-[22px] font-semibold">
          Lalu biarkan alarm menjaganya
        </h2>
        <p className="mt-2.5 max-w-[58ch] text-[14.5px] font-light leading-relaxed text-ink-2">
          Saham yang disimpan dicek ulang setiap pagi ke {contoh ? "data yang ada di server ini" : "data resmi"}.
          Yang berubah dikirim ke kotak masuk dan ke Telegram, tanpa perlu membuka apa pun.
        </p>
        <Link
          href="/pasang"
          className="group mt-5 inline-flex items-center gap-3 rounded-full bg-accent py-1 pl-6 pr-1 text-[14px] font-medium text-accent-ink no-underline transition-transform duration-300 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Pasang alarm untuk saham yang dipantau
          <span
            aria-hidden="true"
            className="grid h-9 w-9 place-items-center rounded-full bg-accent-ink text-accent transition-colors duration-300"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
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
              Tanda seperti ini yang bisa dijadikan alarm, lalu dipasang pada saham yang dipantau.
            </p>
          </div>
          <LinimasaBukti symbol={bukti.symbol} namaEmiten={bukti.namaEmiten} tanda={bukti.tanda} contoh={contoh} />
        </section>
      ) : null}

      {/* ---------- Bagian 4: lihat buktinya (metodologi + rakit sendiri) ---------- */}
      {/* Angka uji dipindah ke kartu kaca di hero (spec menaruh metrik di sana),
          jadi di sini tinggal kalimat sumbernya. DESIGN.md aturan 1: satu fakta
          tampil sekali per layar. */}
      <section aria-labelledby="angka" className="masuk mt-14 rounded-kartu border border-line bg-surface p-8">
        <h2 id="angka" className="m-0 font-display text-[22px] font-semibold">
          Lihat buktinya
        </h2>
        <p className="mt-2 max-w-[58ch] text-[14.5px] font-light leading-relaxed text-ink-2">
          Aturan bawaan diuji ke saham yang benar-benar bermasalah, diukur sampai hari sahamnya berhenti diperdagangkan.
          Sesudah hari itu sahamnya tidak bisa dilepas lagi, jadi tanda yang datang belakangan tidak dihitung.
        </p>
        <p className="mt-5 text-[12.5px] text-ink-3">
          Snapshot {fmtTanggal(skor.today)} dari aturan bawaan, dihitung ulang setiap kali tesnya berjalan.{" "}
          <Link href="/cara-kami-menghitung" className="font-semibold text-accent underline">
            Cara angka ini dihitung
          </Link>
          .
        </p>
        {/* Bento grid (spec "Pricing Bento Grid"): tiga kartu radius 2rem, tiap
            kartu punya gambar di paruh atas dengan gradien ke hitam di bawahnya.
            Di sini "gambar" itu bukan stok foto melainkan potongan komponen
            nyata dari halaman tujuan, dirender dari token yang sama: kartu
            /rakit memperlihatkan pita blok KALAU/MAKA, kartu /pasang
            memperlihatkan lampu status. Nol aset baru, nol rangka palsu. */}
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <Link
            href="/putar-ulang"
            className="group flex flex-col overflow-hidden rounded-kartu-kecil border border-line bg-surface no-underline transition-transform duration-300 hover:scale-[1.03]"
          >
            <span className="gelap relative block h-16 overflow-hidden bg-bg">
              <span aria-hidden="true" className="absolute bottom-2 left-3 font-mono text-[11px] text-ink-3">
                2023-09-30
              </span>
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-black"
              />
            </span>
            <span className="block p-6">
              <span className="block font-display text-[17px] font-semibold text-ink group-hover:text-accent">
                Putar ulang satu saham
              </span>
              <span className="mt-1.5 block text-[13px] font-light leading-relaxed text-ink-2">
                Geser waktu ke belakang dan lihat tanda apa yang sudah terbit pada tanggal itu, lengkap dengan sumbernya.
              </span>
            </span>
          </Link>
          <Link
            href="/rakit"
            className="group flex flex-col overflow-hidden rounded-kartu-kecil border border-line bg-surface no-underline transition-transform duration-300 hover:scale-[1.03]"
          >
            <span className="gelap relative flex h-16 items-center gap-1.5 overflow-hidden bg-bg px-3">
              <span className="rounded bg-b-if px-2 py-1 text-[10px] font-semibold text-b-text">KALAU</span>
              <span className="rounded bg-b-cond px-2 py-1 text-[10px] font-semibold text-b-text">suspensi</span>
              <span className="rounded bg-b-then px-2 py-1 text-[10px] font-semibold text-b-text">MAKA</span>
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-black"
              />
            </span>
            <span className="block p-6">
              <span className="block font-display text-[17px] font-semibold text-ink group-hover:text-accent">
                Rakit aturan sendiri
              </span>
              <span className="mt-1.5 block text-[13px] font-light leading-relaxed text-ink-2">
                Susun syarat dari blok, lalu uji sendiri ke saham yang benar-benar pernah dihapus dari bursa.
              </span>
            </span>
          </Link>
          <Link
            href="/pasang"
            className="group flex flex-col overflow-hidden rounded-kartu-kecil border border-line bg-surface no-underline transition-transform duration-300 hover:scale-[1.03]"
          >
            <span className="gelap relative flex h-16 items-center gap-2 overflow-hidden bg-bg px-3">
              <span className="h-2.5 w-2.5 rounded-full bg-ok" />
              <span className="h-2.5 w-2.5 rounded-full bg-warn" />
              <span className="h-2.5 w-2.5 rounded-full bg-crit" />
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-black"
              />
            </span>
            <span className="block p-6">
              <span className="block font-display text-[17px] font-semibold text-ink group-hover:text-accent">
                Pasang dan dijaga tiap pagi
              </span>
              <span className="mt-1.5 block text-[13px] font-light leading-relaxed text-ink-2">
                Saham yang dipantau dicek ulang sendiri, dan yang berubah dikirim ke kotak masuk serta Telegram.
              </span>
            </span>
          </Link>
        </div>
      </section>

      {/* ---------- Bagian 5: pita batas, selebar halaman ---------- */}
      <section aria-labelledby="batas" className="masuk mt-14 rounded-kartu bg-warn-soft px-8 py-6">
        <h2 id="batas" className="m-0 font-display text-[17px] font-semibold text-ink">
          Batasnya jelas
        </h2>
        <p className="m-0 mt-2 max-w-[72ch] text-[13.5px] font-light leading-relaxed text-ink-2">
          Tidak ada eksekusi transaksi, tidak ada anjuran, dan tidak ada penilaian tentang emiten mana pun.{" "}
          {contoh ? (
            <>Server ini memakai data contoh berlabel, lengkap dengan sumbernya.</>
          ) : (
            <>Yang ditampilkan hanya fakta resmi beserta tanggal dan sumbernya.</>
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
