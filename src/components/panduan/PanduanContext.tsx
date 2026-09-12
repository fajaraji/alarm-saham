"use client";
// State "overlay panduan terbuka" dibagi antara tombol Panduan di header dan
// overlay 3 langkah di layout, tanpa event bus global.
//
// Provider ini juga memasang penanda hidrasi <html data-siap="1"> karena ia
// membungkus SETIAP halaman (layout akar) — lihat komentar di `useEffect`.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface NilaiPanduan {
  terbuka: boolean;
  buka: () => void;
  tutup: () => void;
}

const PanduanContext = createContext<NilaiPanduan | null>(null);

export function PanduanProvider({ children }: { children: ReactNode }) {
  const [terbuka, setTerbuka] = useState(false);
  const buka = useCallback(() => setTerbuka(true), []);
  const tutup = useCallback(() => setTerbuka(false), []);
  const nilai = useMemo(() => ({ terbuka, buka, tutup }), [terbuka, buka, tutup]);

  /**
   * Penanda hidrasi. Seluruh layar dirender di server lebih dulu, jadi tombol,
   * slider, dan blok palet sudah TERLIHAT dan bisa diklik jauh sebelum bundel
   * klien tiba — tetapi handler-nya belum terpasang, sehingga klik sedini itu
   * hilang tanpa jejak. Effect ini hanya jalan setelah React selesai hidrasi,
   * jadi `<html data-siap="1">` menyatakan satu fakta yang jujur: halaman ini
   * sekarang benar-benar interaktif.
   *
   * Dipakai produk untuk berhenti membohongi kursor: palet dan pegangan blok
   * memasang `cursor: grab`, padahal sebelum hidrasi tidak ada yang bisa
   * diseret (globals.css → `html:not([data-siap]) .butuh-hidrasi`). Dipakai
   * tes lewat `tungguSiap(page)` di tests/e2e/util.ts.
   */
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.siap = "1";
    return () => {
      delete html.dataset.siap;
    };
  }, []);

  return <PanduanContext.Provider value={nilai}>{children}</PanduanContext.Provider>;
}

export function usePanduan(): NilaiPanduan {
  const v = useContext(PanduanContext);
  if (!v) throw new Error("usePanduan harus dipakai di dalam <PanduanProvider>");
  return v;
}
