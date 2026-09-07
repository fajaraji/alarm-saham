import type { Metadata } from "next";

import { PapanRakit } from "@/components/rakit/PapanRakit";
import { TEKS } from "@/components/rakit/teks";

export const metadata: Metadata = {
  title: "Rakit alarm · Alarm Saham",
  description: "Seret blok syarat ke papan alarm, lalu uji ke masa lalu.",
};

export default function HalamanRakit() {
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
            <span className="flex items-center gap-2 rounded-lg px-3 py-2 text-ink-2">
              <span className="grid h-[22px] w-[22px] place-items-center rounded-full border border-line-strong font-mono text-[11px]">1</span>
              Putar ulang
            </span>
            <span aria-current="page" className="flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2 font-semibold text-ink">
              <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-accent font-mono text-[11px] text-accent-ink">2</span>
              Rakit alarm
            </span>
            <span className="flex items-center gap-2 rounded-lg px-3 py-2 text-ink-2">
              <span className="grid h-[22px] w-[22px] place-items-center rounded-full border border-line-strong font-mono text-[11px]">3</span>
              Pasang
            </span>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-6 pb-16 pt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-ink-3">{TEKS.eyebrow}</p>
        <h1 className="mb-1.5 mt-1 font-display text-[28px] font-extrabold leading-tight tracking-tight text-balance">
          {TEKS.judul}
        </h1>
        <ol className="mb-4 grid list-none gap-2.5 p-0 text-[13px] md:grid-cols-3">
          <li className="flex items-start gap-2.5 rounded-[10px] bg-accent-soft px-3 py-2.5">
            <b className="min-w-[18px] font-display text-lg leading-none text-accent">1</b>
            <span>
              <strong>Seret</strong> blok syarat dari kotak kiri ke papan bergaris putus-putus. Atau ketik keinginanmu dan klik{" "}
              <strong>Minta AI rakit</strong>.
            </span>
          </li>
          <li className="flex items-start gap-2.5 rounded-[10px] bg-accent-soft px-3 py-2.5">
            <b className="min-w-[18px] font-display text-lg leading-none text-accent">2</b>
            <span>
              Klik tombol <strong>ATAU/DAN</strong> di antara blok untuk mengubah cara menggabung. Klik ambang (mis. “telat &gt; 120
              hari”) untuk memperketat.
            </span>
          </li>
          <li className="flex items-start gap-2.5 rounded-[10px] bg-accent-soft px-3 py-2.5">
            <b className="min-w-[18px] font-display text-lg leading-none text-accent">3</b>
            <span>
              Klik <strong>Uji ke masa lalu</strong>. AI memberi tahu di mana alarmmu bolong dan menyarankan blok tambahan.
            </span>
          </li>
        </ol>

        <PapanRakit />
      </main>

      <footer className="border-t border-line bg-surface">
        <p className="mx-auto max-w-[1200px] px-6 py-4 text-center text-xs text-ink-3">{TEKS.disclaimer}</p>
      </footer>
    </>
  );
}
