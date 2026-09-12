"use client";
// Tooltip/popover kamus yang aksesibel, tanpa dependensi: tombol bergaris
// putus-putus dengan `aria-describedby` → kotak penjelasan (role="tooltip").
// Buka saat hover/fokus/klik; tutup saat Esc, klik di luar, atau kursor keluar.
// Klik = kunci terbuka (untuk layar sentuh); hover/fokus = sementara.
import Link from "next/link";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { entriKamus, type IdIstilah } from "./kamus";

interface Props {
  id: IdIstilah;
  children: ReactNode;
  /** Tambahan kelas untuk tombolnya (mis. warna teks). */
  className?: string;
}

export function Istilah({ id, children, className }: Props) {
  const e = entriKamus(id);
  const tipId = useId();
  const [terbuka, setTerbuka] = useState(false);
  const [terkunci, setTerkunci] = useState(false);
  const [rataKanan, setRataKanan] = useState(false);
  const wadah = useRef<HTMLSpanElement>(null);
  const kotak = useRef<HTMLSpanElement>(null);
  /** Fokus yang kami pindahkan sendiri (setelah Esc) tidak boleh membuka lagi. */
  const abaikanFokus = useRef(false);

  const tutup = useCallback(() => {
    setTerbuka(false);
    setTerkunci(false);
  }, []);

  // Bila kotak melewati tepi kanan layar, rata-kanankan.
  useLayoutEffect(() => {
    if (!terbuka || !kotak.current) return;
    const r = kotak.current.getBoundingClientRect();
    setRataKanan(r.right > window.innerWidth - 8);
  }, [terbuka]);

  useEffect(() => {
    if (!terbuka) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") {
        ev.stopPropagation();
        tutup();
        // Kembalikan fokus ke pemicu hanya bila fokus sedang di dalam kotak (tautan Kamus).
        if (kotak.current?.contains(document.activeElement)) {
          abaikanFokus.current = true;
          wadah.current?.querySelector("button")?.focus();
          abaikanFokus.current = false;
        }
      }
    }
    function onKlikLuar(ev: MouseEvent) {
      if (wadah.current && !wadah.current.contains(ev.target as Node)) tutup();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onKlikLuar);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onKlikLuar);
    };
  }, [terbuka, tutup]);

  return (
    <span
      ref={wadah}
      className="relative inline-block"
      onMouseEnter={() => setTerbuka(true)}
      onMouseLeave={() => {
        if (!terkunci) setTerbuka(false);
      }}
    >
      <button
        type="button"
        aria-describedby={tipId}
        aria-expanded={terbuka}
        data-istilah={id}
        onClick={() => {
          if (terkunci) tutup();
          else {
            setTerbuka(true);
            setTerkunci(true);
          }
        }}
        onFocus={() => {
          if (!abaikanFokus.current) setTerbuka(true);
        }}
        onBlur={(ev) => {
          if (!terkunci && !wadah.current?.contains(ev.relatedTarget as Node | null)) setTerbuka(false);
        }}
        className={`istilah cursor-help rounded-sm border-0 bg-transparent p-0 underline decoration-dotted decoration-1 underline-offset-[3px] hover:decoration-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className ?? ""}`}
      >
        {children}
      </button>
      <span
        ref={kotak}
        id={tipId}
        role="tooltip"
        hidden={!terbuka}
        data-testid={`tooltip-${id}`}
        className={`absolute top-full z-40 mt-1.5 w-[min(320px,80vw)] rounded-xl border border-line bg-surface p-3 text-left text-[12.5px] font-normal normal-case leading-snug tracking-normal text-ink shadow-panel ${rataKanan ? "right-0" : "left-0"}`}
      >
        <b className="block font-display text-[13px] font-bold">{e.istilah}</b>
        <span className="mt-1 block text-ink-2">{e.definisi}</span>
        <span className="mt-1 block italic text-ink-3">{e.perumpamaan}</span>
        <Link
          href={`/kamus#${e.id}`}
          className="mt-1.5 inline-block font-semibold text-accent underline"
          onClick={tutup}
        >
          Lihat di Kamus →
        </Link>
      </span>
    </span>
  );
}
