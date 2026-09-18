// Satu sumber urutan dan nama langkah, dipakai header (HeaderNav) dan tombol
// Sebelumnya / Berikutnya (NavigasiLangkah). Kalau urutan atau nama langkah
// berubah, keduanya ikut berubah bersama; tidak ada yang bisa tertinggal.

export const ALUR_LANGKAH = [
  { href: "/putar-ulang", n: "1", label: "Putar ulang" },
  { href: "/rakit", n: "2", label: "Rakit alarm" },
  { href: "/pasang", n: "3", label: "Pasang" },
] as const;

export type HrefLangkah = (typeof ALUR_LANGKAH)[number]["href"];

/** Isi navigasi header: tiga langkah alur, lalu Kamus. */
export const NAV_HEADER = [...ALUR_LANGKAH, { href: "/kamus", n: "?", label: "Kamus" }] as const;
