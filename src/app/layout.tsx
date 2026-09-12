import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

import { FooterDisclaimer } from "@/components/panduan/FooterDisclaimer";
import { HeaderNav } from "@/components/panduan/HeaderNav";
import { OverlayPanduan } from "@/components/panduan/OverlayPanduan";
import { PanduanProvider } from "@/components/panduan/PanduanContext";
import { sumberSitus } from "@/lib/sumber-situs";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
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
