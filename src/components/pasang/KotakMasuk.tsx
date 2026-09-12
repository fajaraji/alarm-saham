"use client";
// Kotak masuk in-app: bendera baru sejak cek sebelumnya (tersimpan di browser).
import { DISCLAIMER_PESAN } from "@/lib/disclaimer";
import type { PesanKotakMasuk } from "@/lib/jaga/simpan";

import { KELAS_STATUS, TEKS } from "./teks";

interface Props {
  pesan: PesanKotakMasuk[];
  onTandaiDibaca: () => void;
  /** Id portofolio di server — kode untuk perintah /mulai di bot Telegram (tiket 12). */
  kodePortofolio?: string | null;
}

/** Buang kalimat disclaimer dari akhir teks; ia dirender terpisah di kartu. */
function tanpaDisclaimer(teks: string): string {
  const i = teks.lastIndexOf(DISCLAIMER_PESAN);
  return (i === -1 ? teks : teks.slice(0, i)).trim();
}

function fmtWaktu(iso: string): string {
  try {
    return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function KotakMasuk({ pesan, onTandaiDibaca, kodePortofolio }: Props) {
  const baru = pesan.filter((p) => p.baru).length;
  return (
    <section aria-labelledby="judul-kotak" className="rounded-[14px] border border-line bg-surface p-3.5" data-testid="kotak-masuk" data-baru={baru}>
      <div className="flex items-center justify-between gap-2">
        <h3 id="judul-kotak" className="font-display text-[15px] font-bold">
          {TEKS.kotakJudul}
          {/* text-crit-ink, bukan text-white: --crit berbalik jadi merah muda terang di mode gelap. */}
          {baru ? <span className="ml-2 rounded-full bg-crit px-2 py-0.5 text-[11px] text-crit-ink">{baru} baru</span> : null}
        </h3>
        {baru ? (
          <button type="button" onClick={onTandaiDibaca} className="text-[12px] text-accent underline">
            Tandai dibaca
          </button>
        ) : null}
      </div>
      <p className="mb-2.5 text-xs text-ink-3">{TEKS.kotakSub}</p>
      <p className="mb-2.5 text-[11.5px] leading-snug text-ink-3" data-testid="kotak-cron">
        Setiap pagi (±06:30 WIB) server mengecek ulang portofoliomu; bendera baru muncul di sini.
        {kodePortofolio ? (
          <>
            {" "}
            Ingin lewat Telegram? Kirim <code className="rounded bg-line/50 px-1">/mulai {kodePortofolio}</code> ke bot Alarm Saham (bila bot aktif). Kode portofolio:{" "}
            <code data-testid="kode-portofolio" className="rounded bg-line/50 px-1">
              {kodePortofolio}
            </code>
          </>
        ) : null}
      </p>
      {pesan.length === 0 ? (
        <p className="text-[13px] text-ink-3">{TEKS.kotakKosong}</p>
      ) : (
        <ul className="flex max-h-[360px] list-none flex-col gap-2 overflow-y-auto p-0">
          {pesan.map((p) => (
            <li key={p.id} className={`rounded-[10px] border px-3 py-2 ${KELAS_STATUS[p.status]} ${p.baru ? "" : "opacity-70"}`} data-testid="bendera">
              <div className="text-[11px] text-ink-3">{fmtWaktu(p.waktu)}</div>
              <b className="block text-[13px] text-ink">{p.judul}</b>
              {/* Kalimat disclaimer selalu ada di AKHIR teks pesan, sehingga dulu
                  ia ikut terpotong `line-clamp-3` dan tidak pernah terlihat di
                  kartu. Sekarang ia dipisah dan dirender di luar area terpotong. */}
              <p className="m-0 mt-0.5 line-clamp-3 text-[12px] leading-snug text-ink-2">{tanpaDisclaimer(p.teks)}</p>
              <p className="m-0 mt-1 text-[11px] leading-snug text-ink-3" data-testid="disclaimer-bendera">
                {DISCLAIMER_PESAN}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
