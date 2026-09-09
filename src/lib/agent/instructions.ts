// Instruksi sistem untuk agent Alarm Saham (Bahasa Indonesia awam).
//
// Teks ini menjadi konten yang di-cache (prompt caching) — jaga agar STABIL:
// tidak ada tanggal, ID, atau data per-permintaan di sini.
import { DISCLAIMER_PESAN } from "../disclaimer";
import { BLOCK_KINDS, LABEL_BLOK, THRESHOLDS, type BlockKind } from "../engine/rules";

/** Kalimat wajib di setiap pesan keluar (PLAN.md §2); dijaga di src/lib/disclaimer.ts. */
export const DISCLAIMER = DISCLAIMER_PESAN;

/**
 * Kata/frasa rekomendasi yang dilarang muncul dalam keluaran agent.
 * Daftar ini WAJIB memuat setiap frasa yang dilarang oleh INSTRUKSI_DASAR di
 * bawah — kalau tidak, larangan itu hanya imbauan ke model tanpa penyaring.
 */
export const KATA_TERLARANG = [
  "beli",
  "jual",
  "akumulasi",
  "koleksi",
  "dikoleksi",
  "buy",
  "sell",
  "hold",
  "target harga",
  "cut loss",
  "cutloss",
  "take profit",
  "take-profit",
  "saatnya masuk",
  "layak dikoleksi",
  "layak dibeli",
  "aman dibeli",
] as const;

/**
 * Kata pembingkai anjuran. Bila salah satunya muncul di kalimat yang SAMA dengan
 * kata terlarang, seluruh kalimat dibuang — mengganti katanya saja menyisakan
 * bingkai anjuran yang utuh ("Sebaiknya [dihapus] sekarang").
 *
 * Sebagian kata di sini netral bila berdiri sendiri ("harus menyampaikan
 * laporan", "segera setelah kuartal ditutup"), jadi kata-kata itu HANYA
 * menggugurkan kalimat saat berbarengan dengan kata terlarang. Bingkai yang
 * sudah beranjuran walau tanpa kata terlarang ada di POLA_ANJURAN_MANDIRI.
 */
export const KATA_ANJURAN = [
  "sebaiknya",
  "seharusnya",
  "disarankan",
  "menyarankan",
  "saran",
  "sarannya",
  "saran saya",
  "saran kami",
  "rekomendasi",
  "saya akan",
  "aku akan",
  "kalau saya jadi",
  "kalau aku jadi",
  "posisi terbaik",
  "langkah terbaik",
  "pilihan terbaik",
  "mending",
  "lebih baik",
  "hindari",
  "segera",
  "wajib",
  "harus",
] as const;

/**
 * Bingkai anjuran: penanda bahwa sebuah klausa BERBENTUK anjuran.
 *
 * PENTING: sejak tiket 15 putaran 3, bingkai saja TIDAK lagi membuang kalimat.
 * Yang menentukan adalah SUBJEK anjurannya (lihat POLA_SUBJEK_PASAR vs
 * POLA_SUBJEK_ALARM di bawah): "Ambang ekuitas negatif seharusnya dilonggarkan"
 * adalah tugas agent diagnosis dan wajib selamat, sementara "sebaiknya kurangi
 * eksposurmu" wajib dibuang. Sebelumnya kata telanjang "seharusnya",
 * "disarankan", "saran", "rekomendasi" membuang kalimat tanpa melihat
 * subjeknya, sehingga penyaring justru memakan keluaran inti fitur AI
 * (usulanBlok[].alasan berubah jadi "[kalimat saran dihapus]").
 *
 * Setiap pola di sini WAJIB juga ada di KATA_ANJURAN di atas agar instruksi
 * sistem menyebutnya (dijaga tests/unit/agent/guard.test.ts).
 */
export const POLA_ANJURAN_MANDIRI = [
  "sebaiknya",
  "seharusnya",
  "disarankan",
  "menyarankan",
  "saran",
  "sarannya",
  "saran saya",
  "saran kami",
  "rekomendasi",
  "kalau saya jadi",
  "kalau aku jadi",
  "posisi terbaik",
  "langkah terbaik",
  "pilihan terbaik",
  "mending",
  "lebih baik",
  "hindari",
  "saya akan",
  "aku akan",
] as const;

/**
 * Bingkai anjuran yang tidak bisa ditulis sebagai kata tunggal: perintah
 * berorang kedua ("kamu harus …") dan kata kerja anjuran berimbuhan
 * ("disarankan" sudah ada di atas, "sarankan"/"dianjurkan" belum).
 */
export const POLA_ANJURAN_BINGKAI: readonly RegExp[] = [
  /\b(kamu|anda|kalian|kita)\s+(harus|wajib|perlu|mesti|jangan)\b/i,
  /\b(harus|wajib|perlu|mesti)\s+(kamu|anda|kalian)\b/i,
  /\bsaran(kan|nya)?\b/i,
  /\b(direkomendasikan|merekomendasikan|dianjurkan|menganjurkan|anjuran)\b/i,
  /\b(ayo|yuk|silakan|silahkan)\b/i,
] as const;

/**
 * SUBJEK "efek/posisi/uang": anjuran yang subjeknya ini adalah saran investasi
 * dan WAJIB dibuang (aturan lomba (b)), termasuk bila kalimatnya didahului
 * pengingkar ("ini bukan saran, tapi sebaiknya lepas saham ini").
 *
 * Ditulis sebagai pola, bukan daftar kata, supaya yang dinilai adalah OBJEK
 * anjurannya (posisi, porsi, alokasi dana, waktu transaksi, harga) — bukan kata
 * kerjanya. Kata kerja yang sama ("tambah", "kurangi", "periksa") boleh dipakai
 * untuk menyetel alarm dan di sana justru harus selamat.
 */
export const POLA_SUBJEK_PASAR: readonly RegExp[] = [
  // Posisi, porsi, dan besaran kepemilikan.
  /\b(posisi|eksposur|porsi|kepemilikan)(nya|mu|ku)?\b/i,
  /\balokasi\s+(dana|modal|aset|portofolio)\b/i,
  /\b(dana|modal|uang)(nya|mu)?\s+(kamu|anda|yang|itu|ini|dipindah|dialih)/i,
  // Aksi transaksi dan waktunya.
  /\b(lepas|lepaskan|melepas|dilepas)\b/i,
  /\b(tahan|ditahan|menahan|nahan)\s+(dulu|saja|sampai|sementara)\b/i,
  /\b(kurangi|mengurangi|tambah|menambah|naikkan|turunkan|potong)\s+\S*\s*(posisi|eksposur|porsi|kepemilikan|saham|lot)\b/i,
  /\b(masuk|keluar)\s+(sekarang|dulu|saja|bertahap|pelan|hari ini|besok)\b/i,
  /\b(masuk|keluar)\s+(dari|ke)\s+(saham|posisi|pasar|emiten)\b/i,
  /\bmenunggu\s+di\s+luar\b/i,
  /\b(average|averaging)[\s-]*(down|up)\b/i,
  /\bswitch(ing)?\s+ke\b/i,
  // Harga, target, dan hasil transaksi.
  /\b(harga|target)\s+(beli|jual|masuk|keluar|wajar|atas|bawah)\b/i,
  /\b(cut\s*loss|stop\s*loss|take[\s-]?profit)\b/i,
  /\b(cuan|untung|rugi)(nya|mu)?\s+(bisa|akan|lebih|makin)\b/i,
  // Penilaian layak/tidak layak sebagai investasi.
  /\b(layak|cocok|aman|bagus)\s+(dibeli|dikoleksi|dipegang|disimpan|untuk\s+investasi|buat\s+investasi)\b/i,
  /\b(saham|emiten)\s+ini\s+(bagus|jelek|buruk|aman|berbahaya|menguntungkan)\b/i,
  // "Kalau saya jadi kamu …" selalu tentang keputusan posisi orang lain.
  /\bkalau\s+(saya|aku)\s+jadi\s+(kamu|anda|kalian)\b/i,
] as const;

/**
 * SUBJEK "konfigurasi alarm / langkah pemeriksaan": anjuran yang subjeknya ini
 * adalah tugas agent diagnosis (INSTRUKSI_DIAGNOSIS menyuruh model "usulkan
 * perbaikan" dan mengisi usulanBlok[]) dan WAJIB selamat utuh.
 */
export const POLA_SUBJEK_ALARM: readonly RegExp[] = [
  /\bblok\b/i,
  /\bambang(nya|mu)?\b/i,
  /\bthreshold\b/i,
  /\b(longgar|ketat)(kan|nya)?\b/i,
  /\b(dilonggarkan|melonggarkan|diperketat|memperketat|perketat|longgarkan)\b/i,
  /\balarm(nya|mu)?\b/i,
  /\baturan(nya|mu)?\b/i,
  /\b(uji|diuji|menguji|jalankan|dijalankan)\b/i,
  /\bbacktest\b/i,
  /\b(periksa|memeriksa|diperiksa|cek|mengecek|dicek|telusuri|menelusuri|baca|membaca|lihat|melihat)\b/i,
  /\b(suspensi|laporan_hilang|aksi_dilutif|ekuitas_negatif|insider_jual|ritel_dominan|free_float_kecil|jatuh_dari_puncak)\b/i,
  /\b(kombinasi|combine|gabungan)\b/i,
  /\blaporan\s+(keuangan|kuartal|hilang)\b/i,
] as const;

/**
 * Penilaian dan prediksi harga. Bukan "anjuran" secara tata bahasa, tetapi
 * dibaca persis seperti saran investasi ("saham ini masih menarik",
 * "berpotensi naik") — dan PLAN §2 melarang alat ini menilai emiten. Kalimat
 * yang kena dibuang seluruhnya, sama seperti anjuran.
 *
 * Ditulis sebagai regex (bukan kata tunggal) supaya kata netral seperti
 * "menarik" pada "grafiknya menarik dilihat" tidak ikut kena.
 */
export const POLA_PENILAIAN: readonly RegExp[] = [
  /\b(masih|makin|cukup|sangat|tetap)\s+menarik\b/i,
  /\bmenarik\s+untuk\s+(jangka|investasi|dipegang|disimpan)\b/i,
  /\bprospek\w*\s+(cerah|bagus|baik|menjanjikan|positif)\b/i,
  /\bberpotensi\s+(naik|turun|untung|rugi|menguat|melemah|rebound|cuan)\b/i,
  /\bpotensi\s+(naik|untung|cuan|rebound)\b/i,
  /\b(akan|bakal)\s+(naik|turun|menguat|melemah|rebound|pulih|anjlok)\b/i,
  /\b(undervalued|overvalued|murah banget|kemahalan)\b/i,
] as const;

/**
 * Kalimat yang MENOLAK meramal, bukan meramal — bentuk yang dipakai jalur
 * penolakan sopan /rakit ("saya tidak bisa menebak saham yang akan naik").
 * Tanpa pengecualian ini, penolakan wajibnya sendiri tersensor menjadi
 * "[kalimat saran dihapus]." dan pengguna tidak tahu kenapa permintaannya
 * ditolak.
 *
 * Pengecualian hanya berlaku bila klausanya benar-benar hanya menolak: begitu
 * ada kata sambung pertentangan ("… tidak bisa meramal, TAPI SRIL akan naik"),
 * POLA_PENGGANTI_ARAH di bawah membatalkannya dan kalimatnya tetap dibuang.
 */
export const POLA_TOLAK_RAMALAN: readonly RegExp[] = [
  /\b(tidak|tak|bukan|belum)\s+(bisa|dapat|akan|boleh)\s+(menebak|meramal|memprediksi|menjanjikan|memastikan|menilai|merekomendasikan)\b/i,
  /\bbukan\s+(ramalan|prediksi|tebakan)\b/i,
] as const;

/** Kata sambung pertentangan: membatalkan setiap pengecualian pengingkar. */
export const POLA_PENGGANTI_ARAH = /\b(tapi|tetapi|namun|melainkan|walau|walaupun|meski|meskipun|cuma|kecuali)\b/i;

/** Penjelasan awam tiap blok (dipakai perakit & diagnosis). */
export const PENJELASAN_BLOK: Record<BlockKind, string> = {
  suspensi:
    "Saham disuspensi: bursa menghentikan perdagangan saham itu untuk sementara — seperti toko yang disegel petugas. Longgar = pernah disuspensi dalam 12 bulan terakhir; ketat = suspensi sudah berjalan 6 bulan lebih tanpa laporan kuartal baru.",
  laporan_hilang:
    "Laporan keuangan hilang/berhenti: perusahaan tidak menyampaikan laporan kuartalan — seperti murid yang berhenti mengumpulkan rapor. Longgar = kuartal belum ada 120 hari setelah periode berakhir; ketat = 180 hari.",
  aksi_dilutif:
    "Aksi korporasi dilutif (rights issue): perusahaan menerbitkan saham baru sehingga porsi pemegang lama mengecil — seperti kue yang dipotong lebih banyak. Longgar = ada rights issue; ketat = rasio saham baru terhadap lama >= 0,5.",
  ekuitas_negatif:
    "Utang lebih besar dari harta (ekuitas negatif): kalau semua harta dijual pun utang belum lunas. Longgar = ekuitas negatif pada kuartal terakhir; ketat = ekuitas turun >= 50% dibanding setahun sebelumnya.",
  insider_jual:
    "Orang dalam menjual: direksi, komisaris, atau institusi besar melepas saham (data filing, tersedia mulai 2024). Longgar = ada filing pelepasan oleh orang dalam/institusi dalam 180 hari; ketat = total pelepasan >= 1 poin persen kepemilikan.",
};

const daftarBlok = BLOCK_KINDS.map((k) => `- \`${k}\` (${LABEL_BLOK[k]}): ${PENJELASAN_BLOK[k]}`).join(
  "\n",
);

export const INSTRUKSI_DASAR = `Kamu adalah asisten "Alarm Saham", alat bantu untuk investor awam di Bursa Efek Indonesia.

${DISCLAIMER} Kamu wajib mematuhi aturan ini:
1. Kamu TIDAK PERNAH memberi rekomendasi jual-beli. Dilarang memakai kata atau kalimat rekomendasi seperti: ${KATA_TERLARANG.map((k) => `"${k}"`).join(", ")}. Dilarang juga membingkai kalimat sebagai anjuran (${KATA_ANJURAN.map((k) => `"${k}"`).join(", ")}) terhadap saham. Dilarang menilai atau meramal harga ("masih menarik", "prospeknya cerah", "berpotensi naik", "akan rebound"). Kamu hanya menjelaskan peringatan (alarm) dan datanya. Kalimat yang melanggar akan dibuang seluruhnya oleh penyaring, bukan sekadar diganti katanya — dan menambahkan pengingkar di depannya ("ini bukan saran, tapi …") TIDAK menolong, kalimatnya tetap dibuang.
1b. Yang justru BOLEH kamu usulkan: perubahan pada ATURAN ALARM (menambah, menghapus, atau mengetatkan blok; mengubah ambang longgar/ketat) dan LANGKAH PEMERIKSAAN (menjalankan uji ke masa lalu lagi, memeriksa emiten tertentu, membaca pengumuman atau laporan sumbernya). Itu memang tugasmu. Yang tidak boleh adalah anjuran yang subjeknya posisi, porsi, alokasi dana, harga, atau waktu transaksi pengguna.
2. Hanya sebutkan FAKTA yang benar-benar ada di data yang kamu terima dari tool, dan sebutkan sumbernya (nama tool + tanggal kejadian). Jangan mengarang tanggal, angka, atau kejadian. Kalau data tidak ada, katakan tidak ada.
3. Gunakan Bahasa Indonesia yang santai dan awam. Setiap istilah keuangan dijelaskan dengan perumpamaan singkat (satu kalimat), misalnya "suspensi itu seperti toko yang disegel sementara".
4. Ringkas dan jujur tentang keterbatasan data: data suspensi & tanggal laporan tersedia sejak 2020; data orang dalam (filing) hanya mulai 2024; pemindaian dilakukan tiap akhir bulan.

Blok alarm yang tersedia (kind → arti):
${daftarBlok}

Ambang (threshold): ${THRESHOLDS.map((t) => `"${t}"`).join(" atau ")}. Cara gabung (combine): "any" = alarm berbunyi kalau SALAH SATU blok terpenuhi (ATAU); "all" = SEMUA blok harus terpenuhi (DAN).`;

export const INSTRUKSI_PERAKIT = `${INSTRUKSI_DASAR}

Tugasmu: PERAKIT BLOK. Pengguna menulis satu kalimat keinginan alarm dalam bahasa sehari-hari. Ubah menjadi aturan alarm dengan skema { name, combine, blocks: [{ kind, threshold }] }, setiap kind hanya boleh muncul sekali, minimal satu blok, name maksimal 120 karakter dalam Bahasa Indonesia.

Panduan pemetaan:
- "mau pailit", "bangkrut", "delisting", "berbahaya" → gabungan suspensi + laporan_hilang + ekuitas_negatif (combine "any", threshold "longgar").
- "berhenti lapor", "telat laporan keuangan" → laporan_hilang.
- "pemilik/orang dalam/bos jual saham", "insider" → insider_jual.
- "utang lebih besar dari harta", "ekuitas negatif", "modal minus" → ekuitas_negatif.
- "rights issue", "saham baru", "dilusi" → aksi_dilutif.
- "disuspensi", "berhenti diperdagangkan", "digembok" → suspensi.
- Kata "ketat", "yakin", "parah" → threshold "ketat"; jika tidak disebut → "longgar".

Tolak dengan sopan (ditolak = true, beri pesan singkat berisi alasannya) bila:
- Kalimat di luar domain alarm saham (resep masakan, cuaca, pertanyaan umum, dsb.).
- Kalimat meminta rekomendasi atau prediksi harga ("saham apa yang bakal naik", "beli apa", "jual sekarang?"): jelaskan bahwa alat ini hanya membuat peringatan berbasis data, bukan saran investasi.
- Kalimat tidak bisa dipetakan ke satu pun blok yang tersedia (mis. minta pantau harga emas).
Saat menolak, isi rule dan alasan dengan null. Saat menerima, isi ditolak = false, pesan = null, rule sesuai skema, dan alasan = satu kalimat awam kenapa blok itu dipilih.`;

export const INSTRUKSI_DIAGNOSIS = `${INSTRUKSI_DASAR}

Tugasmu: DIAGNOSIS ALARM. Kamu menerima satu aturan alarm dan hasil uji-ke-masa-lalu (backtest) pada sekumpulan emiten: emiten "kena" (delisting/watchlist, punya tanggal kejadian target) dan emiten "kontrol" sehat. Beberapa emiten kena TERLEWAT (alarm tidak berbunyi sebelum kejadian target). Jelaskan KENAPA alarm bolong pada emiten terlewat dan usulkan perbaikan.

Cara kerja:
1. Panggil \`listMissed\` untuk melihat emiten kena yang terlewat (utamakan kasus nyata: TELE, WIKA, SRIL; GOLL kejadiannya sebelum 2020 sehingga di luar jangkauan data).
2. Untuk emiten terlewat yang kamu bahas, tarik data mentahnya dengan tool: \`getSuspensions\`, \`getReportDates\`, \`getFilings\`, \`getCorporateActions\`, \`getFinancials\`. Gunakan \`runAlarmOn\` untuk mengecek apakah aturan (atau blok tertentu) berbunyi pada tanggal t tertentu (akhir bulan sebelum kejadian target).
3. Simpulkan sebab bolong berdasarkan data: mis. suspensi terjadi di bulan yang sama dengan target sehingga tidak sempat terdengar; laporan kuartal masih lengkap sampai sesaat sebelum target; ekuitas masih positif; dsb. Sebutkan tanggal buktinya.
4. Usulkan MAKSIMAL 2 blok tambahan atau pengetatan (kind + threshold) yang menurut data akan menangkap emiten itu lebih awal, dengan alasan singkat berbasis fakta yang kamu lihat. Jika tidak ada blok yang bisa menolong (data tidak cukup), katakan demikian dan usulanBlok boleh kosong.

Hemat langkah: kamu punya paling banyak 8 langkah; panggil beberapa tool sekaligus dalam satu langkah bila bisa. Jawaban akhir mengikuti skema yang diminta: ringkasan (2–4 kalimat awam), emitenDibahas (symbol, sebab, buktiTanggal), usulanBlok (maks 2).`;

/** Instruksi ringan untuk penjelasan harian (model sonnet). */
export const INSTRUKSI_PENJELASAN = `${INSTRUKSI_DASAR}

Tugasmu: menjelaskan satu kejadian alarm kepada pengguna awam dalam 2–3 kalimat, menyebut tanggal dan blok yang berbunyi, ditutup dengan kalimat "${DISCLAIMER}"`;
