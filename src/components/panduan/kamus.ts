// Kamus istilah Alarm Saham (tiket 13): satu sumber untuk tooltip `Istilah`
// dan halaman /kamus. Nada profesional netral (tanpa kata ganti orang),
// istilah pasar modal dipertahankan dalam bahasa Inggris bila memang baku di BEI
// (delisting, rights issue, filing, free float). `perumpamaan` kini memuat
// padanan risiko pasar modal, bukan analogi sehari-hari.
// Hanya fakta yang bersumber dari data Sectors/BEI dan docs repo ini
// (docs/data-proof.md); tanpa kata penilaian (PLAN.md §5 Q5).
import type { BlokBKind } from "@/lib/jaga/blok-b";
import type { BlockKind } from "@/lib/engine/rules";

export const ID_ISTILAH = [
  "delisting",
  "berpotensi_delisting",
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
  /** Perumpamaan risiko pasar modal (padanan konsep, bukan analogi sehari-hari). */
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
      "Pencabutan pencatatan efek dari daftar bursa resmi. Status kepemilikan saham tetap tercatat di KSEI, tetapi efek tidak dapat lagi ditransaksikan di pasar reguler.",
    perumpamaan: "Risiko likuiditas absolut: perdagangan terkunci dan transaksi hanya bisa dilakukan lewat pasar negosiasi.",
    catatan: "Tahun ini 18 saham dihapus dari bursa, efektif 10 November 2026 (pengumuman resmi BEI).",
    lihat: [PUTAR_ULANG, METODOLOGI],
  },
  {
    id: "berpotensi_delisting",
    istilah: "Berpotensi delisting",
    definisi:
      "Saham yang berada dalam masa suspensi perdagangan lebih dari 6 bulan berturut-turut. Bursa mengumumkan daftar ini secara berkala sebelum eksekusi delisting paksa (force delisting).",
    perumpamaan: "Status peringatan likuiditas tinggi: saham berisiko delisting permanen bila kelangsungan usaha tidak pulih.",
    catatan: "59 saham per 30 Juni 2026 (pengumuman BEI Peng-S-00019/BEI.PLP/06-2026).",
    lihat: [PUTAR_ULANG, METODOLOGI],
  },
  {
    id: "suspensi",
    istilah: "Disuspensi (dibekukan sementara)",
    definisi:
      "Penghentian sementara perdagangan efek oleh bursa. Selama suspensi berlangsung, posisi modal investor terkunci dan tidak bisa dicairkan di pasar reguler.",
    perumpamaan: "Pembekuan likuiditas pasar: permintaan dan penawaran tidak dapat dipasangkan sampai bursa mencabut suspensi.",
    // Kalimat ini menerangkan KEDALAMAN sumbernya, bukan mengaku server ini
    // memegang feed sebursa: pada jalur data contoh yang ada hanya suspensi
    // beberapa emiten fixture.
    catatan:
      "Di sumbernya (feed BEI lewat Sectors) data suspensi baru padat sejak 2020 dan tidak memuat tanggal pencabutan. Berapa emiten yang benar-benar ada tergantung sumber data yang sedang dipakai server ini.",
    lihat: [PUTAR_ULANG, RAKIT],
  },
  {
    id: "laporan_hilang",
    istilah: "Laporan keuangan hilang/berhenti",
    definisi:
      "Emiten wajib menyampaikan laporan keuangan berkala setiap kuartal ke bursa. Blok ini aktif saat kuartal laporan melewati tenggat tanpa keterbukaan informasi resmi.",
    perumpamaan: "Indikasi gangguan transparansi atau tata kelola: investor kehilangan dasar penilaian kinerja fundamental.",
    catatan:
      "Bukan “telat”: data Sectors hanya memuat kuartal yang tersedia, bukan tanggal penyampaian, jadi laporan yang telat lalu akhirnya disampaikan tidak terdeteksi. Data sejak kuartal 1 2020.",
    lihat: [PUTAR_ULANG, RAKIT],
  },
  {
    id: "insider_jual",
    istilah: "Pemilik/orang dalam menjual (filing)",
    definisi:
      "Direksi, komisaris, atau pemegang saham utama wajib menyampaikan keterbukaan informasi (filing) saat mengubah porsi kepemilikan. Blok ini aktif jika ada laporan pelepasan saham signifikan.",
    perumpamaan: "Sinyal distribusi kepemilikan: pihak terafiliasi mengurangi eksposur risiko atas efek bersangkutan.",
    catatan: "Feed filing Sectors hanya memuat data sejak 2024, jadi blok ini hanya bisa diklaim untuk jendela 2024 ke depan.",
    lihat: [RAKIT, METODOLOGI],
  },
  {
    id: "ekuitas_negatif",
    istilah: "Utang lebih besar dari harta (ekuitas negatif)",
    definisi: "Kondisi defisiensi modal ketika total liabilitas emiten melampaui total aset. Pada neraca keuangan, nilai modal bersih berada di bawah nol.",
    perumpamaan: "Risiko solvabilitas: emiten berada dalam posisi defisit modal yang menekan kelangsungan usaha.",
    catatan: "Data keuangan kuartalan hanya ditarik untuk 18 emiten yang dihapus dari bursa (1 kredit per kuartal), sejak 2020.",
    lihat: [PUTAR_ULANG, RAKIT],
  },
  {
    id: "rights_issue",
    istilah: "Aksi korporasi dilutif (rights issue)",
    definisi:
      "Penambahan modal dengan Hak Memesan Efek Terlebih Dahulu (HMETD). Porsi persentase kepemilikan pemegang saham terdilusi bila hak tebus tidak dieksekusi.",
    perumpamaan: "Efek dilusi modal: jumlah lembar saham beredar bertambah sehingga nilai laba per saham (EPS) terbagi lebih banyak.",
    catatan: "Sumber: feed aksi korporasi Sectors (umumnya 2020+).",
    lihat: [PUTAR_ULANG, RAKIT],
  },
  {
    id: "ritel_dominan",
    istilah: "Ritel dominan",
    definisi:
      "Transaksi 14 hari terakhir didominasi broker ritel domestik, sementara broker institusi dan asing mencatatkan pelepasan bersih (net sell).",
    perumpamaan: "Pergeseran struktur likuiditas: saham berpindah ke pemegang ritel dengan ketahanan modal lebih rapuh.",
    catatan: "Data terkini saja (tidak ada sejarahnya di Sectors), jadi hanya dipakai di mode Pasang dan memakai kredit.",
    lihat: [PASANG],
  },
  {
    id: "free_float",
    istilah: "Free float",
    definisi:
      "Porsi saham yang beredar bebas dan dimiliki oleh publik di luar pemegang saham pengendali. Porsi di bawah ketentuan minimum bursa meningkatkan volatilitas harga.",
    perumpamaan: "Kedalaman pasar tipis: volume transaksi terbatas sehingga pergerakan harga mudah berfluktuasi tajam.",
    catatan: "Hanya snapshot hari ini (cache 24 jam, 10 kredit per tarikan seluruh bursa); tidak bisa diuji ke masa lalu.",
    lihat: [PASANG],
  },
  {
    id: "jatuh_dari_puncak",
    istilah: "Jatuh dari puncak 90 hari",
    definisi: "Penurunan harga penutupan saham sebesar 30% atau lebih dari titik tertinggi (high) dalam kurun waktu 90 hari perdagangan.",
    perumpamaan: "Tekanan turun teknikal: pelemahan tren harga signifikan yang menembus level penopang sebelumnya.",
    catatan: "Data harian 90 hari, 1 kredit per saham; hanya mode Pasang.",
    lihat: [PASANG],
  },
  {
    id: "alarm_palsu",
    istilah: "Alarm palsu",
    definisi:
      "Kondisi ketika parameter alarm terpicu pada saham kelompok kontrol yang sehat. Metrik ini membatasi sensitivitas agar sistem tidak memicu sinyal keliru berlebihan.",
    perumpamaan: "Penyaringan false positive: menyeimbangkan deteksi risiko nyata tanpa memicu sinyal bahaya yang tidak perlu.",
    lihat: [RAKIT, METODOLOGI],
  },
  {
    id: "lebih_awal",
    istilah: "Lebih awal",
    definisi:
      "Jarak waktu (dalam bulan) antara alarm pertama kali berbunyi dan tanggal bursa menghentikan perdagangan saham secara permanen.",
    perumpamaan: "Jendela waktu antisipasi: periode yang tersedia bagi investor untuk mengevaluasi posisi sebelum likuiditas bursa hilang.",
    catatan: "Dihitung dalam bulan utuh; kejadian sebelum 2021 tidak ikut rata-rata karena data laporan baru mulai 2020. Jeda sehari-dua karena lonjakan harga tidak dihitung sebagai berhenti diperdagangkan.",
    lihat: [RAKIT, METODOLOGI],
  },
  {
    id: "kontrol_sehat",
    istilah: "Kontrol sehat",
    definisi:
      "Kelompok pembanding beranggotakan 30 saham konstituen LQ45 tanpa catatan suspensi pada periode 2019 sampai 2026, dipakai untuk mengukur tingkat alarm palsu.",
    perumpamaan: "Uji tolok ukur (benchmark): memastikan kriteria alarm tidak aktif pada emiten berfundamental stabil.",
    lihat: [RAKIT, METODOLOGI],
  },
  {
    id: "kredit_sectors",
    istilah: "Kredit Sectors",
    definisi:
      "Satuan kuota pemanggilan data API Sectors dengan alokasi 1.000 unit. Uji historis membaca basis data lokal (nol kredit), sementara data terkini memakai kredit resmi.",
    perumpamaan: "Anggaran konsumsi data eksternal: dicatat transparan di setiap pemanggilan untuk menjaga efisiensi integrasi.",
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

/** Kalimat disclaimer footer (PLAN.md §2). Bunyinya dijaga di src/lib/disclaimer.ts. */
export { DISCLAIMER_UI as DISCLAIMER } from "@/lib/disclaimer";
