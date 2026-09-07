"use client";
// State "overlay panduan terbuka" dibagi antara tombol Panduan di header dan
// overlay 3 langkah di layout, tanpa event bus global.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

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
  return <PanduanContext.Provider value={nilai}>{children}</PanduanContext.Provider>;
}

export function usePanduan(): NilaiPanduan {
  const v = useContext(PanduanContext);
  if (!v) throw new Error("usePanduan harus dipakai di dalam <PanduanProvider>");
  return v;
}
