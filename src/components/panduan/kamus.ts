// Kamus istilah Alarm Saham (tiket 13): satu sumber untuk tooltip `Istilah`
// dan halaman /kamus. Bahasa awam, kalimat pendek, perumpamaan sehari-hari.
// Hanya fakta yang bersumber dari data Sectors/BEI dan docs repo ini
// (docs/data-proof.md); tanpa kata penilaian (PLAN.md §5 Q5).
import type { BlokBKind } from "@/lib/jaga/blok-b";
import type { BlockKind } from "@/lib/engine/rules";

export const ID_ISTILAH = [
  "delisting",
  "pemantauan_khusus",
  "suspensi",
  "laporan_hilang",
  "insider_jual",
  "ekuitas_negatif",
  "rights_issue",
  "ritel_dominan",
  "free_float",
  "jatuh_dari_puncak",
  "alarm_palsu",
  "lebih_awal",
  "kontrol_sehat",
  "kredit_sectors",
] as const;
export type IdIstilah = (typeof ID_ISTILAH)[number];

export interface EntriKamus {
  id: IdIstilah;
  /** Nama istilah untuk judul kamus (awam dulu, istilah teknis dalam kurung). */
  istilah: string;
  /** Definisi singkat, satu–dua kalimat. */
  definisi: string;
  /** Perumpamaan sehari-hari (alarm rumah/CCTV/rapor). */
  perumpamaan: string;
  /** Fakta/keterbatasan data yang jujur (opsional). */
  catatan?: string;
  /** Tautan "lihat di halaman …". */
  lihat: { href: string; label: string }[];
}

const PUTAR_ULANG = { href: "/putar-ulang", label: "Putar ulang" };
const RAKIT = { href: "/rakit", label: "Rakit alarm" };
const PASANG = { href: "/pasang", label: "Pasang" };
const METODOLOGI = { href: "/cara-kami-menghitung", label: "Cara kami menghitung" };

export const KAMUS: readonly EntriKamus[] = [
  {
    id: "delisting",
    istilah: "Dihapus dari bursa (delisting)",
    definisi:
      "Saham dicabut dari daftar bursa. Kamu masih tercatat sebagai pemilik, tetapi sahamnya tidak bisa lagi diperdagangkan di bursa.",
    perumpamaan: "Seperti toko yang izinnya dicabut: bangunannya masih ada, tapi pintunya ditutup untuk umum.",
    catatan: "Tahun ini 18 saham dihapus dari bursa, efektif 10 November 2026 (pengumuman resmi BEI).",
    lihat: [PUTAR_ULANG, METODOLOGI],
  },
  {
    id: "pemantauan_khusus",
    istilah: "Papan pemantauan khusus",
    definisi:
      "Daftar khusus dari bursa untuk saham yang sedang diawasi lebih ketat. Masih bisa diperdagangkan, tetapi dengan pembatasan.",
    perumpamaan: "Seperti ruang karantina: belum keluar dari sekolah, tetapi dipisahkan dan diawasi lebih sering.",
    catatan: "59 saham per 30 Juni 2026 (Peng-S-00019/BEI.PLP/06-2026).",
    lihat: [PUTAR_ULANG, METODOLOGI],
  },
  {
    id: "suspensi",
    istilah: "Disuspensi (dibekukan sementara)",
    definisi:
      "Bursa menghentikan perdagangan saham itu untuk sementara. Selama dibekukan, uang yang ada di saham itu tidak bisa dicairkan lewat bursa.",
    perumpamaan: "Seperti toko yang disegel petugas: barangmu masih di dalam, tapi tidak bisa diambil sampai segelnya dibuka.",
    catatan: "Feed suspensi seluruh bursa tersedia sejak Desember 2018 (padat sejak 2020) dan tidak memuat tanggal pencabutan.",
    lihat: [PUTAR_ULANG, RAKIT],
  },
  {
    id: "laporan_hilang",
    istilah: "Laporan keuangan hilang/berhenti",
    definisi:
      "Perusahaan wajib menyampaikan laporan keuangan setiap kuartal. Blok ini berbunyi bila ada kuartal yang tidak pernah muncul di daftar laporan, lewat dari tenggat.",
    perumpamaan: "Seperti murid yang berhenti mengumpulkan rapor: gurunya belum tahu nilainya, tapi sudah tahu ada yang tidak beres.",
    catatan:
      "Bukan “telat”: data Sectors hanya memuat kuartal yang tersedia, bukan tanggal penyampaian, jadi laporan yang telat lalu akhirnya disampaikan tidak terdeteksi. Data sejak kuartal 1 2020.",
    lihat: [PUTAR_ULANG, RAKIT],
  },
  {
    id: "insider_jual",
    istilah: "Pemilik/orang dalam menjual (filing)",
    definisi:
      "Direksi, komisaris, atau pemilik besar wajib melapor ke bursa (filing) saat mengubah kepemilikan sahamnya. Blok ini berbunyi bila ada laporan pelepasan saham oleh orang dalam atau institusi.",
    perumpamaan: "Seperti pemilik rumah yang diam-diam mengangkut perabotnya keluar: belum tentu pindah, tapi patut diperhatikan.",
    catatan: "Feed filing Sectors hanya memuat data sejak 2024, jadi blok ini hanya bisa diklaim untuk jendela 2024 ke depan.",
    lihat: [RAKIT, METODOLOGI],
  },
  {
    id: "ekuitas_negatif",
    istilah: "Utang lebih besar dari harta (ekuitas negatif)",
    definisi: "Kalau semua harta perusahaan dijual pun, utangnya belum lunas. Di laporan keuangan, angka ekuitasnya di bawah nol.",
    perumpamaan: "Seperti rumah tangga yang tabungannya habis dan masih punya cicilan menumpuk.",
    catatan: "Data keuangan kuartalan hanya ditarik untuk 18 emiten yang dihapus dari bursa (1 kredit per kuartal), sejak 2020.",
    lihat: [PUTAR_ULANG, RAKIT],
  },
  {
    id: "rights_issue",
    istilah: "Aksi korporasi dilutif (rights issue)",
    definisi:
      "Perusahaan menerbitkan saham baru dalam jumlah besar. Porsi kepemilikan pemegang saham lama otomatis mengecil bila tidak ikut menebus.",
    perumpamaan: "Seperti kue yang tiba-tiba dipotong jadi lebih banyak bagian: potonganmu tetap satu, tapi ukurannya lebih kecil.",
    catatan: "Sumber: feed aksi korporasi Sectors (umumnya 2020+).",
    lihat: [PUTAR_ULANG, RAKIT],
  },
  {
    id: "ritel_dominan",
    istilah: "Ritel dominan",
    definisi:
      "Dalam 14 hari terakhir, sebagian besar pembelian datang dari broker ritel (orang biasa), sementara broker asing/institusi lebih banyak melepas.",
    perumpamaan: "Seperti pesta yang tamu-tamu besarnya sudah pulang satu per satu sementara tamu baru terus berdatangan.",
    catatan: "Data terkini saja (tidak ada sejarahnya di Sectors), jadi hanya dipakai di mode Pasang dan memakai kredit.",
    lihat: [PASANG],
  },
  {
    id: "free_float",
    istilah: "Free float",
    definisi:
      "Porsi saham yang benar-benar beredar di publik, di luar pemilik besar. Kalau kecil (di bawah 15%), harganya mudah digerakkan segelintir pihak.",
    perumpamaan: "Seperti perahu kecil: sedikit orang bergeser saja sudah oleng.",
    catatan: "Hanya snapshot hari ini (cache 24 jam, 10 kredit per tarikan seluruh bursa); tidak bisa diuji ke masa lalu.",
    lihat: [PASANG],
  },
  {
    id: "jatuh_dari_puncak",
    istilah: "Jatuh dari puncak 90 hari",
    definisi: "Harga penutupan terakhir sudah turun 30% atau lebih dari harga tertinggi dalam 90 hari terakhir.",
    perumpamaan: "Seperti termometer yang turun jauh dari suhu tertinggi minggu ini: angkanya fakta, artinya belum tentu.",
    catatan: "Data harian 90 hari, 1 kredit per saham; hanya mode Pasang.",
    lihat: [PASANG],
  },
  {
    id: "alarm_palsu",
    istilah: "Alarm palsu",
    definisi:
      "Alarm berbunyi pada saham kontrol yang sehat. Makin sedikit makin bagus, tetapi alarm yang tidak pernah salah biasanya juga jarang menangkap apa-apa.",
    perumpamaan: "Seperti alarm rumah yang berbunyi karena kucing lewat: mengganggu, tapi lebih baik daripada alarm yang tidak pernah bunyi.",
    lihat: [RAKIT, METODOLOGI],
  },
  {
    id: "lebih_awal",
    istilah: "Lebih awal",
    definisi:
      "Berapa bulan alarm sudah berbunyi sebelum kejadian target (suspensi yang berujung dihapus dari bursa, atau masuk pemantauan khusus).",
    perumpamaan: "Seperti alarm asap yang berbunyi beberapa menit sebelum api membesar: waktu itulah gunanya alarm.",
    catatan: "Dihitung dalam bulan utuh; kejadian sebelum 2021 tidak ikut rata-rata karena data laporan baru mulai 2020.",
    lihat: [RAKIT, METODOLOGI],
  },
  {
    id: "kontrol_sehat",
    istilah: "Kontrol sehat",
    definisi:
      "30 saham anggota LQ45 yang tidak pernah muncul di feed suspensi 2019–2026. Dipakai untuk mengukur berapa sering alarm salah bunyi.",
    perumpamaan: "Seperti CCTV yang diuji juga di lorong sepi: kalau di sana pun sering “melihat pencuri”, berarti alatnya yang perlu dibenahi.",
    lihat: [RAKIT, METODOLOGI],
  },
  {
    id: "kredit_sectors",
    istilah: "Kredit Sectors",
    definisi:
      "Setiap panggilan ke API Sectors memakai kredit dari jatah 1.000. Uji ke masa lalu dan putar ulang membaca database kami, jadi nol kredit; hanya data terkini di mode Pasang yang memakai kredit.",
    perumpamaan: "Seperti pulsa: dipakai hemat, dicatat setiap kali terpakai, dan sisanya disimpan untuk demo.",
    lihat: [PASANG, METODOLOGI],
  },
];

const PETA = new Map<IdIstilah, EntriKamus>(KAMUS.map((e) => [e.id, e]));

export function entriKamus(id: IdIstilah): EntriKamus {
  const e = PETA.get(id);
  if (!e) throw new Error(`Istilah '${id}' tidak ada di kamus`);
  return e;
}

/** Istilah kamus untuk tiap blok kelas A (agar label blok bisa dibungkus tooltip). */
export const ISTILAH_BLOK: Record<BlockKind, IdIstilah> = {
  suspensi: "suspensi",
  laporan_hilang: "laporan_hilang",
  aksi_dilutif: "rights_issue",
  ekuitas_negatif: "ekuitas_negatif",
  insider_jual: "insider_jual",
};

/** Istilah kamus untuk tiap blok kelas B. */
export const ISTILAH_BLOK_B: Record<BlokBKind, IdIstilah> = {
  ritel_dominan: "ritel_dominan",
  free_float_kecil: "free_float",
  jatuh_dari_puncak: "jatuh_dari_puncak",
};

export function istilahUntukBlok(kind: string): IdIstilah | null {
  if (kind in ISTILAH_BLOK) return ISTILAH_BLOK[kind as BlockKind];
  if (kind in ISTILAH_BLOK_B) return ISTILAH_BLOK_B[kind as BlokBKind];
  return null;
}

/** Kunci localStorage: panduan 3 langkah sudah ditutup pengguna. */
export const KUNCI_PANDUAN_SELESAI = "alarm-saham:panduan-selesai";

/** Kalimat disclaimer footer (PLAN.md §2). */
export const DISCLAIMER = "Alarm Saham adalah alat informasi dan analisis, bukan saran investasi.";
