// Lampu hijau/kuning/merah = status aturan default pada tanggal terpilih.
// Hijau: tidak ada blok berbunyi. Kuning: tepat 1 blok (bukan suspensi).
// Merah: >= 2 blok, atau blok suspensi berbunyi.
import type { FireResult } from "../engine/evaluate";
import { LABEL_BLOK, type Rule } from "../engine/rules";
import aturanDefaultJson from "../engine/fixtures/aturan-default.json";

export type WarnaLampu = "hijau" | "kuning" | "merah";

export interface Lampu {
  warna: WarnaLampu;
  judul: string;
  keterangan: string;
  /** Nama blok yang berbunyi (Bahasa Indonesia). */
  blok: string[];
}

/** Aturan default longgar (fixture tiket 06) — bentuknya sudah sesuai skema Rule. */
export const ATURAN_DEFAULT = aturanDefaultJson as Rule;

export function petakanLampu(fire: FireResult): Lampu {
  const blok = fire.reasons.map((r) => LABEL_BLOK[r.kind]);
  const adaSuspensi = fire.reasons.some((r) => r.kind === "suspensi");
  if (fire.reasons.length === 0) {
    return {
      warna: "hijau",
      judul: "Belum ada blok yang berbunyi",
      keterangan: "Pada tanggal ini aturan default tidak menemukan tanda dari data yang tersedia.",
      blok,
    };
  }
  if (fire.reasons.length >= 2 || adaSuspensi) {
    return {
      warna: "merah",
      judul: adaSuspensi ? "Alarm berbunyi: saham sedang disuspensi" : "Alarm berbunyi: beberapa tanda sekaligus",
      keterangan: `${fire.reasons.length} blok terpenuhi: ${blok.join(", ")}.`,
      blok,
    };
  }
  return {
    warna: "kuning",
    judul: "Satu tanda sudah kelihatan",
    keterangan: `Blok yang terpenuhi: ${blok[0]}.`,
    blok,
  };
}
