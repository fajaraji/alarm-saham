"use client";
// Header bersama semua halaman (mockup): merek, langkah 1-2-3, Kamus, Cara
// kami menghitung, dan tombol Panduan. `aria-current` mengikuti pathname.
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import logoAlarmSaham from "@/assets/logo-alarm-saham.png";

import { NAV_HEADER } from "./langkah";
import { TombolPanduan } from "./TombolPanduan";

const LANGKAH = NAV_HEADER;

export function HeaderNav() {
  const pathname = usePathname() ?? "";
  const aktif = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return (
    <header
      className="sticky top-0 z-[var(--z-lengket)] px-3 pt-3 text-ink sm:px-6 sm:pt-4"
      data-testid="header"
    >
      {/* Bilah kaca mengambang (sistem visual 2026-10-03, spec "Navigation"):
          blur 20px, bentuk pil penuh, tepi 1px. Latarnya `--glass-bg` yang
          mengikuti tema — 5% putih di atas hitam, 55% putih di atas terang —
          jadi tautan tidak perlu warna sendiri: `text-ink` sudah benar di
          kedua tema, dan hover memakai `bg-ink/10` yang setara dengan
          `bg-white/10` milik spec saat temanya gelap. */}
      <div className="kaca mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-1.5 rounded-3xl px-4 py-2 sm:gap-y-2 sm:rounded-full sm:px-5 sm:py-2.5">
        {/* Di ponsel header ini pernah memakan ~460px dari 812px sebelum konten
            mulai: merek + tagline + empat chip navigasi yang membungkus jadi dua
            baris + tautan metodologi di baris sendiri + tombol Panduan. Lebih
            dari separuh layar pertama adalah navigasi, sehingga alatnya terdorong
            ke bawah lipatan justru di perangkat yang paling sering dipakai.
            Perbaikannya: tagline disembunyikan di bawah `sm`, navigasi digeser
            mendatar dalam satu baris alih-alih membungkus, dan paddingnya
            dirapatkan. Gulir mendatar ada DI DALAM nav, bukan di halaman. */}
        {/* Merek mengarah ke beranda "/" (sesuai aria-label-nya), sebelumnya ke
            /putar-ulang, sehingga beranda tidak tertaut dari halaman mana pun. */}
        <Link href="/" className="mr-auto flex items-center gap-2.5 no-underline" aria-label="ALSA (Alarm Saham), beranda">
          {/* Logo merek, latar transparan supaya sama benar di tema terang dan
              gelap. `alt` kosong karena nama mereknya sudah ditulis di sebelahnya
              dan tautannya punya aria-label sendiri; memberi alt lagi membuat
              pembaca layar menyebut nama merek dua kali. */}
          {/* `width`/`height` ditulis walau impornya statis: di jsdom (tes UI)
              impor gambar tidak membawa ukuran, dan next/image menolak render
              tanpa itu. */}
          <Image src={logoAlarmSaham} alt="" aria-hidden="true" priority width={32} height={32} className="h-8 w-8 flex-none" />
          {/* Nama merek ALSA (keputusan pemilik 6 Okt 2026). Baris kecilnya
              hanya membuka singkatannya. Dulu baris ini berbunyi "alarm saham
              yang bisa dirakit dari blok syarat" tepat di bawah nama "Alarm
              Saham": kata yang sama diulang, dan yang dijual justru fitur
              rakit, bukan alasan orang datang. */}
          <span>
            <span className="block font-display text-lg font-semibold leading-tight tracking-tight text-ink">ALSA</span>
            <small className="hidden text-[11.5px] text-ink-3 sm:block">Alarm Saham</small>
          </span>
        </Link>
        <nav
          aria-label="Langkah"
          className="-mx-1 flex flex-nowrap gap-1 overflow-x-auto px-1 text-[13px] sm:mx-0 sm:flex-wrap sm:overflow-x-visible sm:px-0"
        >
          {LANGKAH.map((l) => {
            const kini = aktif(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={kini ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 no-underline transition-colors duration-300 ${
                  kini ? "bg-accent-soft font-semibold text-ink" : "text-ink/80 hover:bg-ink/10"
                }`}
              >
                <span
                  className={`grid h-[22px] w-[22px] place-items-center rounded-full font-mono text-[11px] ${
                    kini ? "bg-accent text-accent-ink" : "border border-line-strong"
                  }`}
                >
                  {l.n}
                </span>
                {l.label}
              </Link>
            );
          })}
          <Link
            href="/cara-kami-menghitung"
            aria-current={aktif("/cara-kami-menghitung") ? "page" : undefined}
            className={`flex shrink-0 items-center whitespace-nowrap rounded-full px-3 py-2 no-underline transition-colors duration-300 ${
              aktif("/cara-kami-menghitung") ? "bg-accent-soft font-semibold text-ink" : "text-ink/80 hover:bg-ink/10"
            }`}
          >
            Cara kami menghitung
          </Link>
        </nav>
        <TombolPanduan />
      </div>
    </header>
  );
}
