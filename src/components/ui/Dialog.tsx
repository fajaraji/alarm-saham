"use client";
// Dialog modal kecil yang dipakai ulang: konfirmasi ganti pemilik (tiket 23)
// dan tautan rahasia yang bisa disalin (tiket 24).
//
// Polanya sama dengan OverlayPanduan: `aria-modal`, fokus dijebak di dalam
// kartu (aria-modal menyembunyikan latar dari pembaca layar tetapi tidak
// mengubah urutan Tab), Escape dan klik di luar kartu menutup, dan saat ditutup
// fokus kembali ke elemen yang memegangnya ketika dialog dibuka. Komponen ini
// dirender hanya selama dialog terbuka; induk yang memutuskan kapan.
import { useEffect, useId, useRef, type ReactNode } from "react";

interface Props {
  judul: string;
  onTutup: () => void;
  children: ReactNode;
  testId?: string;
}

const BISA_FOKUS = "a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])";

export function Dialog({ judul, onTutup, children, testId }: Props) {
  const kartu = useRef<HTMLDivElement>(null);
  const idJudul = useId();
  // Penangan keydown dipasang sekali; ref ini memastikan ia memanggil
  // `onTutup` terbaru walau induk membuat fungsi baru di setiap render.
  const tutup = useRef(onTutup);
  useEffect(() => {
    tutup.current = onTutup;
  });

  useEffect(() => {
    const pemicu = document.activeElement;
    kartu.current?.focus();
    const sebelumnya = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") {
        ev.preventDefault();
        tutup.current();
        return;
      }
      if (ev.key !== "Tab" || !kartu.current) return;
      const bisaFokus = [...kartu.current.querySelectorAll<HTMLElement>(BISA_FOKUS)];
      if (bisaFokus.length === 0) return;
      const pertama = bisaFokus[0];
      const terakhir = bisaFokus[bisaFokus.length - 1];
      const kini = document.activeElement;
      if (ev.shiftKey && (kini === pertama || kini === kartu.current)) {
        ev.preventDefault();
        terakhir.focus();
      } else if (!ev.shiftKey && kini === terakhir) {
        ev.preventDefault();
        pertama.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = sebelumnya;
      if (pemicu instanceof HTMLElement && pemicu.isConnected) pemicu.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(15,20,32,.55)] p-5"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onTutup();
      }}
    >
      <div
        ref={kartu}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idJudul}
        tabIndex={-1}
        data-testid={testId}
        className="w-full max-w-[500px] rounded-2xl bg-surface p-6 text-ink shadow-panel outline-none"
      >
        <h2 id={idJudul} className="m-0 mb-2 font-display text-lg font-bold tracking-tight">
          {judul}
        </h2>
        {children}
      </div>
    </div>
  );
}
