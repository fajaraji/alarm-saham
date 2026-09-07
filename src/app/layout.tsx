import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${bricolage.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <nav aria-label="Navigasi" className="flex gap-4 px-6 py-2 text-sm">
          <a href="/putar-ulang" className="underline">
            1. Putar ulang
          </a>
          <a href="/rakit" className="underline">
            2. Rakit alarm
          </a>
          <a href="/pasang" className="underline">
            3. Pasang
          </a>
          <a href="/cara-kami-menghitung" className="underline">
            Cara kami menghitung
          </a>
        </nav>
        {children}
      </body>
    </html>
  );
}
