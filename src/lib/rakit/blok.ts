// Metadata blok untuk layar "Rakit alarm" (tiket 09): label awam, tooltip
// kamus, label ambang yang bisa diklik, dan catatan kedalaman data.
//
// Hanya blok kelas A (bisa diuji ke masa lalu). Blok kelas B ("ritel dominan",
// "free float kecil") sengaja TIDAK ada di sini: data historisnya tidak
// tersedia di Sectors (docs/data-proof.md §2), jadi tidak bisa diuji.
import { BLOCK_KINDS, LABEL_BLOK, type BlockKind, type Threshold } from "../engine/rules";

export interface InfoBlok {
  kind: BlockKind;
  /** Label awam yang tampil di kotak blok. */
  label: string;
  /** Penjelasan singkat (tooltip kamus). */
  tooltip: string;
  /** Teks ambang per tingkat, dipakai chip yang bisa diklik. */
  ambang: Record<Threshold, string>;
  /** Kedalaman data yang jujur ditampilkan ke pengguna. */
  dataSejak: string;
}

export const INFO_BLOK: Record<BlockKind, InfoBlok> = {
  suspensi: {
    kind: "suspensi",
    label: LABEL_BLOK.suspensi,
    tooltip: "Bursa menghentikan perdagangan saham ini. Uang investor terkunci sampai dibuka lagi.",
    ambang: { longgar: "pernah 12 bln terakhir", ketat: "masih berlaku > 6 bln" },
    dataSejak: "data sejak 2020",
  },
  laporan_hilang: {
    kind: "laporan_hilang",
    label: LABEL_BLOK.laporan_hilang,
    tooltip: "Rapor kuartal tidak diserahkan lewat dari tenggat. Lampu kuning pertama sebelum masalah besar.",
    ambang: { longgar: "telat > 120 hari", ketat: "telat > 180 hari" },
    dataSejak: "data sejak 2020",
  },
  aksi_dilutif: {
    kind: "aksi_dilutif",
    label: LABEL_BLOK.aksi_dilutif,
    tooltip: "Perusahaan menerbitkan saham baru (rights issue) sehingga porsi pemegang lama mengecil.",
    ambang: { longgar: "ada rights issue", ketat: "dilusi >= 50%" },
    dataSejak: "data sejak 2020",
  },
  ekuitas_negatif: {
    kind: "ekuitas_negatif",
    label: LABEL_BLOK.ekuitas_negatif,
    tooltip: "Kalau semua harta dijual pun utangnya tidak lunas (ekuitas negatif). Perusahaan sedang sekarat.",
    ambang: { longgar: "ekuitas negatif", ketat: "ekuitas turun >= 50% setahun" },
    dataSejak: "data sejak 2020",
  },
  insider_jual: {
    kind: "insider_jual",
    label: LABEL_BLOK.insider_jual,
    tooltip: "Direksi/pemilik besar wajib melapor kalau menjual saham perusahaannya sendiri. Kalau ramai-ramai jual, itu sinyal.",
    ambang: { longgar: "ada 6 bln terakhir", ketat: "jual >= 1 poin persen" },
    dataSejak: "hanya 2024+",
  },
};

/** Urutan palet mengikuti urutan BLOCK_KINDS di skema. */
export const DAFTAR_BLOK: InfoBlok[] = BLOCK_KINDS.map((k) => INFO_BLOK[k]);

export function labelBlok(kind: BlockKind): string {
  return INFO_BLOK[kind].label;
}

export function labelAmbang(kind: BlockKind, threshold: Threshold): string {
  return INFO_BLOK[kind].ambang[threshold];
}
