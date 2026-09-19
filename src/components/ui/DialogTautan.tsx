"use client";
// Dialog tautan rahasia (tiket 24): menunjukkan tautan `/pasang#kunci=...`
// yang dijanjikan kalimat lama "tautan rahasiamu tersimpan otomatis" tetapi
// tidak pernah ditunjukkan. Tanpa akun, tautan ini satu-satunya jalan membuka
// portofolio yang sama di perangkat lain, jadi ia harus bisa disalin.
//
// Server tanpa database tidak punya tautan apa pun: dialog yang sama lalu
// mengatakan terus terang bahwa alarm hanya ada di browser ini.
import { useId, useRef, useState } from "react";

import { Dialog } from "./Dialog";

export const TEKS_DIALOG_TAUTAN = {
  judul: "Simpan tautan rahasiamu",
  penjelasan:
    "Tautan ini satu-satunya cara membuka portofolio dan alarm yang sama di perangkat atau browser lain. Kami tidak memakai akun, jadi tautan yang hilang tidak bisa dikirim ulang.",
  peringatan: "Siapa pun yang memegang tautan ini bisa melihat dan mengubah portofoliomu. Jangan dibagikan.",
  label: "Tautan rahasia",
  tombolSalin: "Salin tautan",
  tersalin: "Tautan tersalin.",
  salinManual: "Browser tidak mengizinkan salin otomatis. Tautannya sudah ditandai: tekan Ctrl+C, atau tahan lalu pilih Salin di ponsel.",
  judulLokal: "Alarm hanya tersimpan di browser ini",
  penjelasanLokal:
    "Server ini belum punya database, jadi belum ada tautan yang bisa membuka alarm dan portofolio ini di perangkat lain. Menghapus data browser ini ikut menghapusnya.",
  tombolTutup: "Tutup",
} as const;

interface Props {
  /** `null` = server tanpa database: tidak ada tautan yang bisa dibagikan. */
  tautan: string | null;
  onTutup: () => void;
  /** Elemen yang menerima fokus lagi setelah dialog ditutup (lihat Dialog). */
  fokusKembali?: () => HTMLElement | null;
}

export function DialogTautan({ tautan, onTutup, fokusKembali }: Props) {
  const kotak = useRef<HTMLInputElement>(null);
  const idKotak = useId();
  const [status, setStatus] = useState<"tersalin" | "manual" | null>(null);

  async function salin() {
    if (!tautan) return;
    try {
      await navigator.clipboard.writeText(tautan);
      setStatus("tersalin");
      return;
    } catch {
      // Clipboard API ditolak (izin, konteks tidak aman, browser lama): jatuh ke bawah.
    }
    kotak.current?.focus();
    kotak.current?.select();
    let berhasil = false;
    try {
      berhasil = document.execCommand("copy");
    } catch {
      berhasil = false;
    }
    setStatus(berhasil ? "tersalin" : "manual");
  }

  if (!tautan) {
    return (
      <Dialog judul={TEKS_DIALOG_TAUTAN.judulLokal} onTutup={onTutup} testId="dialog-tautan" fokusKembali={fokusKembali}>
        <p data-testid="dialog-tautan-lokal" className="m-0 mb-4 text-[14px] leading-relaxed text-ink-2">
          {TEKS_DIALOG_TAUTAN.penjelasanLokal}
        </p>
        <button
          type="button"
          onClick={onTutup}
          className="rounded-lg border border-line-strong px-4 py-2 text-[13px] font-semibold hover:bg-surface-2"
        >
          {TEKS_DIALOG_TAUTAN.tombolTutup}
        </button>
      </Dialog>
    );
  }

  return (
    <Dialog judul={TEKS_DIALOG_TAUTAN.judul} onTutup={onTutup} testId="dialog-tautan" fokusKembali={fokusKembali}>
      <p className="m-0 mb-2 text-[14px] leading-relaxed text-ink-2">{TEKS_DIALOG_TAUTAN.penjelasan}</p>
      <p className="m-0 mb-3 text-[12.5px] leading-snug text-ink-3">{TEKS_DIALOG_TAUTAN.peringatan}</p>
      <label htmlFor={idKotak} className="mb-1 block text-[12px] font-semibold text-ink-2">
        {TEKS_DIALOG_TAUTAN.label}
      </label>
      <input
        id={idKotak}
        ref={kotak}
        readOnly
        value={tautan}
        data-testid="kotak-tautan"
        onFocus={(e) => e.currentTarget.select()}
        className="mb-3 w-full rounded-lg border border-line-strong bg-bg px-3 py-2 font-mono text-[12px] text-ink"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="tombol-salin-tautan"
          onClick={() => void salin()}
          className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink"
        >
          {TEKS_DIALOG_TAUTAN.tombolSalin}
        </button>
        <button
          type="button"
          onClick={onTutup}
          className="rounded-lg border border-line-strong px-4 py-2 text-[13px] font-semibold hover:bg-surface-2"
        >
          {TEKS_DIALOG_TAUTAN.tombolTutup}
        </button>
      </div>
      <p role="status" data-testid="status-salin" data-status={status ?? ""} className="m-0 mt-2 min-h-[1.25em] text-[12.5px] text-ink-2">
        {status === "tersalin" ? TEKS_DIALOG_TAUTAN.tersalin : status === "manual" ? TEKS_DIALOG_TAUTAN.salinManual : ""}
      </p>
    </Dialog>
  );
}
