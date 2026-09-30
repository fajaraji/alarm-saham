import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

import { FooterDisclaimer } from "@/components/panduan/FooterDisclaimer";
import { HeaderNav } from "@/components/panduan/HeaderNav";
import { OverlayPanduan } from "@/components/panduan/OverlayPanduan";
import { PanduanProvider } from "@/components/panduan/PanduanContext";
import { sumberSitus } from "@/lib/sumber-situs";

// Berkas hurufnya ikut di dalam repositori (src/app/fonts), bukan diunduh dari
// Google saat build.
//
// Dengan `next/font/google`, setiap `next build` menarik berkas huruf dari
// fonts.gstatic.com. Satu gangguan jaringan sesaat membuat build gagal dengan
// pesan yang menyesatkan ("Can't resolve @vercel/turbopack-next/internal/font/
// google/font"), padahal kodenya tidak berubah: itu terjadi di CI run
// 36595679661 pada commit yang lulus dua kali sebelumnya. Bahaya sebenarnya
// bukan CI, melainkan deploy produksi Vercel yang menjalankan build yang sama.
//
// Yang diunduh hanya potongan latin, sama seperti `subsets: ["latin"]` dulu.
// Bricolage Grotesque dan IBM Plex Sans berupa huruf variabel: satu berkas
// meliputi seluruh rentang ketebalan, jadi rentangnya ditulis, bukan daftar
// ketebalan. Rinciannya di src/app/fonts/README.md.
const bricolage = localFont({
  src: [{ path: "./fonts/bricolage-grotesque-variabel.woff2", weight: "500 800", style: "normal" }],
  variable: "--font-bricolage",
  display: "swap",
});

const plexSans = localFont({
  src: [{ path: "./fonts/ibm-plex-sans-variabel.woff2", weight: "400 600", style: "normal" }],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-mono-500.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Alarm Saham",
  description: "Rakit alarm saham dari blok syarat, uji ke masa lalu, dan pasang untuk portofoliomu.",
};

// Header (langkah 1–2–3, Kamus, tombol Panduan), overlay panduan kunjungan
// pertama, dan footer disclaimer dipasang SEKALI di sini untuk semua halaman.
//
// Sumber data dibaca di sini dan diturunkan ke keduanya: kalimat "fakta resmi
// dari feed Sectors" hanya boleh muncul kalau servernya memang berjalan di atas
// database Sectors. `sumberSitus()` memakai `connection()` sehingga penilaian
// terjadi saat permintaan, bukan saat build (build tidak punya DATABASE_URL).
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { nyata } = await sumberSitus();
  return (
    <html lang="id" className={`${bricolage.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <PanduanProvider>
          <HeaderNav />
          <OverlayPanduan sumberNyata={nyata} />
          {children}
          <FooterDisclaimer sumberNyata={nyata} />
        </PanduanProvider>
      </body>
    </html>
  );
}
