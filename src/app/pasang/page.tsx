import type { Metadata } from "next";

import { PanelPasang } from "@/components/pasang/PanelPasang";
import { TEKS } from "@/components/pasang/teks";

export const metadata: Metadata = {
  title: "Pasang · Alarm Saham",
  description: "Pasang alarm untuk portofoliomu: cek saham ke data resmi, peta hijau/kuning/merah, dan pesan penjelasan.",
};

export default function HalamanPasang() {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-4 px-6 py-3">
          <div className="mr-auto flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="grid h-8 w-8 place-items-center rounded-lg bg-accent font-display font-extrabold text-accent-ink"
            >
              !
            </span>
            <div>
              <p className="m-0 font-display text-lg font-bold leading-tight">Alarm Saham</p>
              <small className="block text-[11px] uppercase tracking-wider text-ink-3">alarm saham yang bisa kamu rakit sendiri</small>
            </div>
          </div>
          <nav aria-label="Langkah" className="flex gap-1 text-[13px]">
            <a href="/putar-ulang" className="flex items-center gap-2 rounded-lg px-3 py-2 text-ink-2 hover:bg-surface-2">
              <span className="grid h-[22px] w-[22px] place-items-center rounded-full border border-line-strong font-mono text-[11px]">1</span>
              Putar ulang
            </a>
            <a href="/rakit" className="flex items-center gap-2 rounded-lg px-3 py-2 text-ink-2 hover:bg-surface-2">
              <span className="grid h-[22px] w-[22px] place-items-center rounded-full border border-line-strong font-mono text-[11px]">2</span>
              Rakit alarm
            </a>
            <span aria-current="page" className="flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2 font-semibold text-ink">
              <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-accent font-mono text-[11px] text-accent-ink">3</span>
              Pasang
            </span>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-6 pb-16 pt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-ink-3">{TEKS.eyebrow}</p>
        <h1 className="mb-1.5 mt-1 font-display text-[28px] font-extrabold leading-tight tracking-tight text-balance">{TEKS.judul}</h1>
        <p className="mb-4 max-w-[70ch] text-[13.5px] text-ink-2">{TEKS.lede}</p>
        <ol className="mb-4 grid list-none gap-2.5 p-0 text-[13px] md:grid-cols-3">
          <li className="flex items-start gap-2.5 rounded-[10px] bg-accent-soft px-3 py-2.5">
            <b className="min-w-[18px] font-display text-lg leading-none text-accent">1</b>
            <span>Tambahkan saham yang kamu pegang (kode 4 huruf).</span>
          </li>
          <li className="flex items-start gap-2.5 rounded-[10px] bg-accent-soft px-3 py-2.5">
            <b className="min-w-[18px] font-display text-lg leading-none text-accent">2</b>
            <span>
              Klik <strong>Cek sekarang</strong>. Hijau = aman menurut alarmmu, kuning = satu tanda, merah = alarm berbunyi.
            </span>
          </li>
          <li className="flex items-start gap-2.5 rounded-[10px] bg-accent-soft px-3 py-2.5">
            <b className="min-w-[18px] font-display text-lg leading-none text-accent">3</b>
            <span>Baca pesan penjelasan: syarat mana yang terpenuhi, tanggalnya, dan sumbernya — bukan cuma angka.</span>
          </li>
        </ol>

        <PanelPasang />
      </main>

      <footer className="border-t border-line bg-surface" data-testid="disclaimer">
        <p className="mx-auto max-w-[1200px] px-6 py-4 text-center text-xs text-ink-3">{TEKS.disclaimer}</p>
      </footer>
    </>
  );
}
