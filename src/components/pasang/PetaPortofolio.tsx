"use client";
// Peta portofolio berwarna: satu ubin per saham (hijau/kuning/merah; abu-abu
// bila belum dicek), alasan pertama, tanda "tidak ada data", tombol hapus.
import type { HasilSaham } from "@/lib/jaga/evaluasi";

import { KELAS_STATUS, LABEL_STATUS, TEKS } from "./teks";

interface Props {
  symbols: string[];
  hasil: Map<string, HasilSaham>;
  adaData: Record<string, boolean | null>;
  onHapus: (symbol: string) => void;
  sedangCek: boolean;
}

function ringkasAlasan(h: HasilSaham): string {
  if (h.suspensiAktif) {
    const lain = h.alasan.filter((a) => a.kind !== "suspensi").length;
    return `suspensi aktif sejak ${h.suspensiAktif}${lain ? ` +${lain}` : ""}`;
  }
  if (h.alasan.length === 0) {
    if (h.kelasB.status === "dilewati") return h.kelasB.keterangan.replace(/^dilewati: /, "dilewati: ");
    return "tidak ada syarat terpenuhi";
  }
  const pertama = h.alasan[0].label.toLowerCase();
  return h.alasan.length > 1 ? `${pertama} +${h.alasan.length - 1}` : pertama;
}

export function PetaPortofolio({ symbols, hasil, adaData, onHapus, sedangCek }: Props) {
  if (symbols.length === 0) {
    return (
      <p className="rounded-[10px] border border-dashed border-line-strong px-3 py-6 text-center text-[13px] text-ink-3" data-testid="portofolio-kosong">
        {TEKS.belumAdaSaham}
      </p>
    );
  }
  return (
    <ul
      className="grid list-none gap-2 p-0"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}
      aria-label="Peta portofolio"
      aria-busy={sedangCek}
      data-testid="peta-portofolio"
    >
      {symbols.map((s) => {
        const h = hasil.get(s);
        const status = h?.status;
        const kelas = status ? KELAS_STATUS[status] : "bg-surface-2 text-ink-2 border-line";
        return (
          <li
            key={s}
            data-testid={`tile-${s}`}
            data-status={status ?? "belum"}
            className={`relative flex min-h-[86px] flex-col gap-0.5 rounded-[10px] border px-3 py-2.5 transition-colors ${kelas} ${sedangCek ? "opacity-60" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-display text-lg font-extrabold leading-none tracking-tight text-ink">{s}</span>
              <button
                type="button"
                onClick={() => onHapus(s)}
                aria-label={`Hapus ${s}`}
                title={`Hapus ${s} dari portofolio`}
                className="grid h-6 w-6 place-items-center rounded-full text-ink-3 hover:bg-black/10 hover:text-ink"
              >
                ×
              </button>
            </div>
            <span className="text-[12px] font-semibold" data-testid={`status-${s}`}>
              {status ? LABEL_STATUS[status] : TEKS.belumDicek}
            </span>
            {h ? (
              <span className="text-[11px] leading-snug text-ink-2" data-testid={`alasan-${s}`}>
                {ringkasAlasan(h)}
              </span>
            ) : null}
            {adaData[s] === false ? (
              <span className="mt-auto w-fit rounded-full bg-black/10 px-2 py-0.5 text-[10.5px] font-semibold text-ink-2" data-testid={`tanpa-data-${s}`}>
                {TEKS.tidakAdaData}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
