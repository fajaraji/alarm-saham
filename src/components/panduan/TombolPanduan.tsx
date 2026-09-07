"use client";
// Tombol "Panduan" di header: membuka kembali overlay 3 langkah.
import { usePanduan } from "./PanduanContext";

export function TombolPanduan({ className }: { className?: string }) {
  const { buka } = usePanduan();
  return (
    <button
      type="button"
      onClick={buka}
      data-testid="tombol-panduan"
      className={`rounded-full border border-line-strong bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-ink hover:bg-surface-2 ${className ?? ""}`}
    >
      Panduan
    </button>
  );
}
