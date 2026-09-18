// Tombol Sebelumnya / Berikutnya di bawah halaman langkah (tiket 20).
//
// Pengguna jarang memakai chip bernomor di header untuk pindah langkah, karena
// tidak yakin chip itu bisa diklik. Tombol di akhir halaman, di tempat mata
// berhenti setelah membaca, jelas bisa diklik dan menyebut langkah tujuannya.
// Panah di sini adalah penunjuk arah yang memang berarti (mundur / maju),
// bukan hiasan, jadi dipakai hanya pada dua tombol ini.
import Link from "next/link";

import { ALUR_LANGKAH, type HrefLangkah } from "./langkah";

interface Props {
  /** Langkah halaman yang sedang dibuka. */
  sekarang: HrefLangkah;
}

const KELAS_TOMBOL =
  "group flex min-h-[56px] flex-col justify-center rounded-lg border border-line bg-surface px-4 py-2.5 no-underline transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function NavigasiLangkah({ sekarang }: Props) {
  const i = ALUR_LANGKAH.findIndex((l) => l.href === sekarang);
  const sebelum = i > 0 ? ALUR_LANGKAH[i - 1] : null;
  const berikut = i >= 0 && i < ALUR_LANGKAH.length - 1 ? ALUR_LANGKAH[i + 1] : null;
  if (!sebelum && !berikut) return null;

  return (
    <nav
      aria-label="Pindah langkah"
      data-testid="navigasi-langkah"
      className="mt-10 grid grid-cols-1 gap-3 border-t border-line pt-6 sm:grid-cols-2"
    >
      {sebelum ? (
        <Link href={sebelum.href} className={KELAS_TOMBOL} data-testid="langkah-sebelumnya">
          <span className="text-[12px] text-ink-3">
            <span aria-hidden="true">← </span>Sebelumnya
          </span>
          <span className="font-display text-[15px] font-bold text-ink group-hover:text-accent">
            Langkah {sebelum.n}: {sebelum.label}
          </span>
        </Link>
      ) : null}
      {berikut ? (
        <Link
          href={berikut.href}
          className={`${KELAS_TOMBOL} text-right sm:col-start-2`}
          data-testid="langkah-berikutnya"
        >
          <span className="text-[12px] text-ink-3">
            Berikutnya<span aria-hidden="true"> →</span>
          </span>
          <span className="font-display text-[15px] font-bold text-ink group-hover:text-accent">
            Langkah {berikut.n}: {berikut.label}
          </span>
        </Link>
      ) : null}
    </nav>
  );
}
