// Layout segmen /putar-ulang: font (Bricolage Grotesque + IBM Plex) dan token CSS
// mandiri di bawah .pu. Header, overlay panduan, dan footer disclaimer datang
// dari layout akar (tiket 13) — tidak dipasang lagi di sini.
import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

import "@/components/putar-ulang/putar-ulang.css";

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
      <main className="pu-main">{children}</main>
    </div>
  );
}
