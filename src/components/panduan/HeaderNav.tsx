"use client";
// Header bersama semua halaman (mockup): merek, langkah 1–2–3, Kamus, Cara
// kami menghitung, dan tombol Panduan. `aria-current` mengikuti pathname.
import Link from "next/link";
import { usePathname } from "next/navigation";

import { TombolPanduan } from "./TombolPanduan";

const LANGKAH = [
  { href: "/putar-ulang", n: "1", label: "Putar ulang" },
  { href: "/rakit", n: "2", label: "Rakit alarm" },
  { href: "/pasang", n: "3", label: "Pasang" },
  { href: "/kamus", n: "?", label: "Kamus" },
] as const;

export function HeaderNav() {
  const pathname = usePathname() ?? "";
  const aktif = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface text-ink" data-testid="header">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
        {/* Merek mengarah ke beranda "/" (sesuai aria-label-nya) — sebelumnya ke
            /putar-ulang, sehingga beranda tidak tertaut dari halaman mana pun. */}
        <Link href="/" className="mr-auto flex items-center gap-2.5 no-underline" aria-label="Alarm Saham — beranda">
          <span
            aria-hidden="true"
            className="grid h-8 w-8 place-items-center rounded-lg bg-accent font-display font-extrabold text-accent-ink"
          >
            !
          </span>
          <span>
            <span className="block font-display text-lg font-bold leading-tight text-ink">Alarm Saham</span>
            <small className="block text-[11px] uppercase tracking-wider text-ink-3">alarm saham yang bisa kamu rakit sendiri</small>
          </span>
        </Link>
        <nav aria-label="Langkah" className="flex flex-wrap gap-1 text-[13px]">
          {LANGKAH.map((l) => {
            const kini = aktif(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={kini ? "page" : undefined}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 no-underline ${
                  kini ? "bg-accent-soft font-semibold text-ink" : "text-ink-2 hover:bg-surface-2"
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
            className={`flex items-center rounded-lg px-3 py-2 no-underline ${
              aktif("/cara-kami-menghitung") ? "bg-accent-soft font-semibold text-ink" : "text-ink-2 hover:bg-surface-2"
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
