// Layout segmen /putar-ulang: font (Bricolage Grotesque + IBM Plex) dan token CSS
// mandiri di bawah .pu, agar tidak bergantung pada layout/global CSS tiket lain.
import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Link from "next/link";

import "@/components/putar-ulang/putar-ulang.css";
import { Disclaimer } from "@/components/putar-ulang/Disclaimer";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display" });
const body = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Putar ulang — Alarm Saham",
  description:
    "Lihat rekaman tanda resmi (suspensi, laporan hilang, ekuitas negatif) sebelum sebuah saham dihapus atau masuk pemantauan khusus.",
};

export default function PutarUlangLayout({ children }: LayoutProps<"/putar-ulang">) {
  return (
    <div className={`pu ${display.variable} ${body.variable} ${mono.variable}`}>
      <header className="pu-nav">
        <div className="in">
          <Link href="/" className="pu-brand">
            <div className="mark" aria-hidden>
              !
            </div>
            <div>
              <h1>Alarm Saham</h1>
              <small>Sectors Hackathon 2026</small>
            </div>
          </Link>
          <nav className="pu-steps" aria-label="Langkah">
            <Link href="/putar-ulang" aria-current="page">
              <span className="n">1</span>Putar ulang
            </Link>
            <Link href="/rakit">
              <span className="n">2</span>Rakit alarm
            </Link>
          </nav>
        </div>
      </header>
      <main className="pu-main">{children}</main>
      <div className="pu-main" style={{ paddingTop: 0 }}>
        <Disclaimer />
      </div>
    </div>
  );
}
