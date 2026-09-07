// /kamus — daftar istilah + perumpamaan + tautan "lihat di halaman …".
// Server component tanpa data dinamis; isinya dari components/panduan/kamus.ts
// (sumber yang sama dengan tooltip <Istilah>).
import type { Metadata } from "next";
import Link from "next/link";

import { KAMUS } from "@/components/panduan/kamus";

export const metadata: Metadata = {
  title: "Kamus · Alarm Saham",
  description: "Istilah yang dipakai Alarm Saham, dijelaskan seperti ke teman: suspensi, delisting, laporan hilang, free float, alarm palsu.",
};

export default function HalamanKamus() {
  return (
    <main className="mx-auto w-full max-w-[1000px] flex-1 px-6 pb-16 pt-6" data-testid="kamus">
      <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-ink-3">Kamus</p>
      <h1 className="mb-2 mt-1 font-display text-[28px] font-extrabold leading-tight tracking-tight text-balance">
        Istilah yang dipakai, dijelaskan seperti ke teman.
      </h1>
      <p className="m-0 mb-5 max-w-[70ch] text-ink-2">
        Setiap istilah di layar lain bergaris putus-putus — arahkan kursor atau ketuk untuk membaca artinya. Halaman ini
        memuat semuanya sekaligus, dengan perumpamaan dan keterbatasan datanya yang jujur.
      </p>

      <nav aria-label="Daftar istilah" className="mb-5 flex flex-wrap gap-1.5 text-[12.5px]">
        {KAMUS.map((e) => (
          <a key={e.id} href={`#${e.id}`} className="rounded-full border border-line bg-surface px-2.5 py-1 text-ink-2 no-underline hover:border-accent">
            {e.istilah}
          </a>
        ))}
      </nav>

      <dl className="m-0 grid gap-3">
        {KAMUS.map((e) => (
          <div
            key={e.id}
            id={e.id}
            data-testid={`kamus-${e.id}`}
            className="scroll-mt-20 rounded-xl border border-line bg-surface p-4"
          >
            <dt className="font-display text-base font-bold">{e.istilah}</dt>
            <dd className="m-0 mt-1 max-w-[70ch] text-ink-2">{e.definisi}</dd>
            <dd className="m-0 mt-1 max-w-[70ch] italic text-ink-3">{e.perumpamaan}</dd>
            {e.catatan ? <dd className="m-0 mt-1 max-w-[70ch] text-[12.5px] text-ink-3">Data: {e.catatan}</dd> : null}
            <dd className="m-0 mt-2 text-[12.5px]">
              Lihat di halaman{" "}
              {e.lihat.map((l, i) => (
                <span key={l.href}>
                  {i > 0 ? " · " : ""}
                  <Link href={l.href} className="font-semibold text-accent underline">
                    {l.label}
                  </Link>
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
