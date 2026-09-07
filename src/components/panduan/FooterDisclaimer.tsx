// Footer disclaimer (PLAN.md §2) — dipasang sekali di layout akar sehingga ada
// di SEMUA halaman. Halaman tidak boleh memasang footer disclaimer sendiri.
import Link from "next/link";

import { DISCLAIMER } from "./kamus";

export function FooterDisclaimer() {
  return (
    <footer className="mt-auto border-t border-line bg-surface" data-testid="disclaimer">
      <p className="mx-auto max-w-[1200px] px-6 py-4 text-center text-xs text-ink-3">
        <strong className="text-ink-2">{DISCLAIMER}</strong> Semua kejadian yang tampil adalah fakta resmi dari feed Sectors
        (data BEI) dengan nama endpoint dan tautan dokumen bila tersedia; tidak ada penilaian tentang emiten mana pun. Data
        laporan dan keuangan tersedia sejak kuartal 1 2020, filing orang dalam sejak 2024.{" "}
        <Link href="/cara-kami-menghitung" className="underline">
          Cara kami menghitung
        </Link>{" "}
        ·{" "}
        <Link href="/kamus" className="underline">
          Kamus istilah
        </Link>
      </p>
    </footer>
  );
}
