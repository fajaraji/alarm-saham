// Tiga petunjuk bernomor di atas tiap layar (mockup "howto strip").
// Komponen server-friendly: isi tiap langkah boleh memuat <Istilah> (klien).
import type { ReactNode } from "react";

interface Props {
  langkah: readonly ReactNode[];
  /** Label aksesibel daftar (default "Cara pakai layar ini"). */
  label?: string;
}

export function PetunjukLayar({ langkah, label = "Cara pakai layar ini" }: Props) {
  return (
    <ol className="mb-4 grid list-none gap-2.5 p-0 text-[13px] md:grid-cols-3" aria-label={label} data-testid="petunjuk-layar">
      {langkah.map((isi, i) => (
        <li key={i} className="flex items-start gap-2.5 rounded-[10px] bg-accent-soft px-3 py-2.5 text-ink" data-testid="petunjuk">
          <b aria-hidden="true" className="min-w-[18px] font-display text-lg leading-none text-accent">
            {i + 1}
          </b>
          <span>{isi}</span>
        </li>
      ))}
    </ol>
  );
}
