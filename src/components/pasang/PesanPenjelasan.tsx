"use client";
// Panel pesan penjelasan per saham: teks awam (template atau rapian AI),
// daftar alasan terstruktur (blok, tanggal, sumber), dan rincian kelas B.
import type { HasilSaham } from "@/lib/jaga/evaluasi";
import type { Penjelasan } from "@/lib/jaga/penjelasan";

import { Istilah } from "@/components/panduan/Istilah";
import { istilahUntukBlok } from "@/components/panduan/kamus";

import { KELAS_STATUS, LABEL_STATUS, TEKS } from "./teks";

interface Props {
  saham: HasilSaham[];
  penjelasan: Penjelasan[];
  today: string | null;
}

export function PesanPenjelasan({ saham, penjelasan, today }: Props) {
  if (saham.length === 0) {
    return <p className="text-[13px] text-ink-3">{TEKS.belumDicek}</p>;
  }
  const teks = new Map(penjelasan.map((p) => [p.symbol, p]));
  return (
    <ul className="flex list-none flex-col gap-3 p-0" aria-label="Pesan per saham">
      {saham.map((h) => {
        const p = teks.get(h.symbol);
        return (
          <li key={h.symbol} data-testid={`pesan-${h.symbol}`} data-status={h.status} className="rounded-[10px] border border-line bg-surface p-3">
            <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-3">
              <span className={`rounded-full border px-2 py-0.5 font-semibold ${KELAS_STATUS[h.status]}`}>{LABEL_STATUS[h.status]}</span>
              <span>
                {today ? `Dicek ${today}` : ""}
                {p?.olehAi ? " · dirapikan AI" : " · teks otomatis"}
                {p?.perluTinjau ? " · rapian AI ditolak penjaga, dipakai teks otomatis" : ""}
              </span>
            </div>
            <p className="m-0 text-[13.5px] leading-relaxed">
              <b>{h.symbol}</b> — {p?.teks ?? ""}
            </p>
            {h.alasan.length ? (
              <details className="mt-2 text-[12px] text-ink-2">
                <summary className="cursor-pointer font-semibold">Rincian syarat & sumber ({h.alasan.length})</summary>
                <ul className="mt-1 list-disc pl-5">
                  {h.alasan.map((a) => {
                    const idIstilah = istilahUntukBlok(a.kind);
                    return (
                      <li key={a.kind} data-testid={`alasan-${h.symbol}-${a.kind}`}>
                        <b>{idIstilah ? <Istilah id={idIstilah}>{a.label}</Istilah> : a.label}</b>
                        {a.threshold ? ` (${a.threshold})` : ""}: {a.detail}
                        {a.tanggal ? ` · tanggal ${a.tanggal}` : ""} · <span className="font-mono text-[11px]">{a.sumber}</span>
                        {a.alarm.length ? ` · alarm: ${a.alarm.map((x) => x.name).join(", ")}` : ""}
                      </li>
                    );
                  })}
                </ul>
              </details>
            ) : null}
            {h.kelasB.status !== "nonaktif" ? (
              <p className="mb-0 mt-2 text-[12px] text-ink-3" data-testid={`kelas-b-${h.symbol}`}>
                Data terkini: {h.kelasB.keterangan}
                {h.kelasB.blok.length ? (
                  <>
                    {" "}
                    —{" "}
                    {h.kelasB.blok.map((b) => `${b.kind}: ${b.terpenuhi ? "terpenuhi" : "tidak"} (${b.detail})`).join("; ")}
                  </>
                ) : null}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
