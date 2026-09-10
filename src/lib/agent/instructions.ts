// Instruksi sistem untuk agent Alarm Saham (Bahasa Indonesia awam).
//
// Teks ini menjadi konten yang di-cache (prompt caching) — jaga agar STABIL:
// tidak ada tanggal, ID, atau data per-permintaan di sini.
//
// ===========================================================================
// TIGA LAPIS KEPATUHAN ATURAN LOMBA (b) — dan pembagian tugasnya
//
// Empat putaran menambal penyaring kalimat membuktikan bahwa regex tidak bisa
// mengklasifikasi SUBJEK kalimat Bahasa Indonesia: dua penyerang independen
// mengukur versi terakhir (commit 72a33ca) dan menemukan 60 dari 65 anjuran
// investasi baru lolos utuh (setiap imbuhan, salah ketik, tanda hubung, dan
// slang bursa melewati daftar kata tertutup) SEKALIGUS 41 dari 83 kalimat sah
// dimakan (termasuk kedua `usulanBlok[].alasan` pada satu objek diagnosis
// realistis). Karena itu tugasnya dibagi, dan batas tiap lapis ditulis jujur:
//
//   1. KONTROL UTAMA — instruksi sistem di berkas ini. INSTRUKSI_DASAR butir 1
//      dan 1b menyatakan apa yang dilarang (menyinggung membeli, menjual,
//      menahan, atau mengalihkan posisi/dana pengguna) dan apa yang justru
//      tugasnya (menjelaskan fakta data + mengusulkan konfigurasi alarm),
//      ditambah CONTOH_NEGATIF sebagai few-shot. Ini yang benar-benar
//      menentukan isi jawaban.
//   2. KONTROL STRUKTURAL — bentuk keluaran. `usulanBlok[].kind` dan
//      `threshold` adalah enum (bukan prosa), `buktiTanggal` adalah tanggal,
//      dan medan prosa bebas sengaja sempit (ringkasan 2–4 kalimat, satu
//      `alasan` per usulan). Model tidak punya tempat untuk menuliskan
//      instruksi transaksi tanpa terlihat.
//   3. BACKSTOP — FRASA_BACKSTOP di bawah, dipakai src/lib/agent/guard.ts.
//      Ia PENDETEKSI PRESISI-TINGGI, bukan pengklasifikasi: hanya frasa yang
//      tidak mungkin bermakna lain di domain ini. Recall-nya rendah dengan
//      sengaja dan TIDAK menjamin semua anjuran tertangkap.
//
// KATA_TERLARANG dan KATA_ANJURAN di bawah adalah daftar untuk LAPIS 1 (apa
// yang diberitahukan ke model), BUKAN daftar penyaring. Sebagian di antaranya
// sengaja tidak punya padanan di FRASA_BACKSTOP: kata telanjang "beli"/"jual"
// muncul di kalimat fakta yang wajib selamat ("nilai jual saham oleh orang
// dalam Rp88 miliar", "volume beli bersih ritel 81%"), jadi menyaringnya
// merusak keluaran inti produk.
// ===========================================================================
import { DISCLAIMER_PESAN } from "../disclaimer";
import { BLOCK_KINDS, LABEL_BLOK, THRESHOLDS, type BlockKind } from "../engine/rules";

/** Kalimat wajib di setiap pesan keluar (PLAN.md §2); dijaga di src/lib/disclaimer.ts. */
export const DISCLAIMER = DISCLAIMER_PESAN;

/**
 * Kata/frasa rekomendasi yang DILARANG DITULIS MODEL — daftar untuk lapis 1.
 *
 * Daftar ini disalin ke INSTRUKSI_DASAR butir 1 supaya model tahu batasnya.
 * Ia BUKAN daftar penyaring: hanya sebagian yang punya padanan presisi-tinggi
 * di FRASA_BACKSTOP. Jangan menambah kata ke sini dengan harapan penyaring ikut
 * menangkapnya — itu asumsi yang membuat penyensor lama salah dua arah.
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
 * Kata pembingkai anjuran — juga daftar untuk lapis 1 saja.
 *
 * Sebagian kata di sini netral bila berdiri sendiri ("emiten harus
 * menyampaikan laporan", "segera setelah kuartal ditutup") dan sebagian
 * lainnya justru WAJIB dipakai agent diagnosis ("sebaiknya tambahkan blok
 * suspensi", "saran perbaikan: perketat ambangnya"). Karena itu tidak satu pun
 * dari kata ini dipakai sebagai bukti oleh backstop.
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

// ===========================================================================
// LAPIS 3 — BACKSTOP FRASA PRESISI-TINGGI
// ===========================================================================

/** Satu frasa backstop. `pola` dicocokkan pada teks yang sudah dinormalkan. */
export interface FrasaBackstop {
  /** Label kanonik yang dicatat di `kataDisensor` dan ditampilkan ke peninjau. */
  label: string;
  /**
   * Sumber regex (tanpa flag). Dicocokkan pada teks yang sudah dinormalkan
   * guard.ts: huruf kecil, tanda hubung/pisah → spasi, spasi ganda dibiarkan
   * (pola memakai `\s+`). Normalisasi mempertahankan panjang string sehingga
   * indeks hasil cocok masih menunjuk ke teks ASLI dan hanya frasa itu yang
   * diredaksi.
   */
  pola: string;
  /** Kenapa frasa ini tidak mungkin bermakna lain di domain Alarm Saham. */
  alasan: string;
}

/**
 * Frasa yang di domain ini TIDAK MUNGKIN bermakna lain selain instruksi
 * bertransaksi atau penilaian layak-tidaknya sebuah efek.
 *
 * ATURAN MENAMBAH BARIS — presisi di atas recall, tanpa kecuali:
 *   1. Frasa harus gagal dicocokkan pada SELURUH bagian `harusUtuh` di
 *      tests/fixtures/korpus-anjuran.json. Tes korpus akan merah kalau tidak.
 *   2. Jangan mendaftar kata tunggal yang juga muncul di kalimat fakta:
 *      "beli", "jual", "harga wajar", "alokasi dana", "akan naik", "tidak
 *      cocok", "posisi … harus", "bobot" — semuanya sudah terbukti memakan
 *      keluaran sah dan sengaja TIDAK ada di sini.
 *   3. Jangan memperpanjang daftar slang/salah ketik ("lego", "boncos",
 *      "nyangkut", "cutlos", "juall", "bli", "hol"): itu perlombaan yang tidak
 *      bisa dimenangkan daftar kata, dan recall rendah sudah diterima sebagai
 *      konsekuensi. Yang menahan bentuk-bentuk itu adalah lapis 1 dan 2.
 *   4. Kode emiten (TELE, SRIL) TIDAK dinormalkan menjadi kata "saham", karena
 *      normalisasi yang mengubah panjang string membuat redaksi frasa tidak
 *      bisa menunjuk posisi aslinya. "Hindari SRIL" karena itu tidak tertangkap.
 */
export const FRASA_BACKSTOP: readonly FrasaBackstop[] = [
  // --- A. Istilah transaksi yang tidak punya pemakaian lain ---------------
  {
    label: "cut loss",
    pola: "cut\\s*los+(?:nya)?",
    alasan: "istilah menutup posisi rugi; tidak punya arti lain. Menoleransi tanda hubung dan spasi ganda lewat normalisasi",
  },
  {
    label: "stop loss",
    pola: "stop\\s*los+(?:nya)?",
    alasan: "batas kerugian otomatis pada order; hanya ada dalam konteks transaksi",
  },
  { label: "take profit", pola: "take\\s*profit", alasan: "merealisasikan keuntungan posisi" },
  {
    label: "average down",
    pola: "(?:average|avg)\\s*(?:down|up)|averaging",
    alasan: "menambah posisi untuk menggeser harga rata-rata",
  },
  { label: "switching", pola: "\\bswitching\\b", alasan: "memindahkan dana antar-efek" },
  {
    label: "target harga",
    pola: "\\b(?:target\\s+harga|harga\\s+target)\\b",
    alasan: "harga sasaran transaksi; alat ini tidak menilai harga",
  },
  {
    label: "ambil untung",
    pola: "\\bambil\\s+untung(?:nya|mu)?\\b|\\brealisasi(?:kan)?\\s+(?:untung|keuntungan|cuan)\\b",
    alasan: "take profit dalam Bahasa Indonesia",
  },
  { label: "hold", pola: "\\bhold\\b", alasan: "instruksi menahan posisi; tidak muncul di kalimat fakta Bahasa Indonesia" },
  {
    label: "saatnya masuk",
    pola: "\\bsaatnya\\s+(?:masuk|keluar|jual|beli)\\b",
    alasan: "waktu bertransaksi, dilarang eksplisit INSTRUKSI_DASAR butir 1b",
  },
  { label: "hajar kanan", pola: "\\bhajar\\s+kanan\\b", alasan: "membeli di harga penawaran; hanya istilah bursa" },

  // --- B. Ajakan bertransaksi atas efek tertentu --------------------------
  {
    // Lookbehind menahan frasa nomina fakta ("nilai jual saham ini", "volume
    // beli saham itu") yang boleh muncul di laporan data.
    label: "jual saham ini",
    pola:
      "(?<!\\b(?:nilai|harga|volume|tanggal|total|jumlah|tipe)\\s)" +
      "\\b(?:jual|beli|lepas|lepaskan|buang|borong|serok|koleksi|akumulasi(?:kan)?)" +
      "\\s+(?:saja\\s+|aja\\s+|dulu\\s+|sekarang\\s+)?saham\\s+(?:ini|itu)\\b",
    alasan: "verba transaksi bentuk perintah + efek yang ditunjuk; bentuk pasif berimbuhan (dijual/dibeli) tidak ikut",
  },
  {
    label: "jual sekarang",
    pola:
      "(?<!\\b(?:nilai|harga|volume|tanggal|total|jumlah|tipe)\\s)" +
      "\\b(?:jual|beli|sell|buy)\\s+(?:sekarang|now|hari\\s+ini)\\b",
    alasan: "verba transaksi bentuk perintah + waktu; 'keluar sekarang' pada subjek laporan tidak ikut",
  },
  {
    label: "layak dibeli",
    pola: "\\b(?:layak|pantas|aman|cocok|bagus)\\s+di(?:beli|koleksi|jual|lepas|buang|pegang|simpan|pertahankan|tahan|lirik)\\b",
    alasan: "penilaian layak-tidaknya sebuah efek sebagai investasi; 'tidak cocok dipakai' (tentang blok) tidak ikut",
  },
  {
    label: "jangan dilepas",
    pola: "\\bjangan\\s+di(?:lepas|jual|beli|buang|tahan)\\b",
    alasan: "larangan bertransaksi atas efek",
  },
  { label: "tutup posisi", pola: "\\btutup\\s+posisi(?:nya|mu)?\\b", alasan: "menutup posisi; 'tutup buku' tidak ikut" },
  {
    label: "kosongkan portofolio",
    pola: "\\bkosongkan\\s+(?:saja\\s+|dulu\\s+|isi\\s+){0,3}(?:portofolio|porsi|posisi|lot|eksposur|kepemilikan)",
    alasan: "perintah menghabiskan seluruh kepemilikan pengguna",
  },
  {
    label: "keluar dari posisi",
    pola: "\\b(?:masuk|keluar)\\s+(?:dulu\\s+|saja\\s+|aja\\s+|sekarang\\s+|lagi\\s+)?(?:dari|ke)\\s+(?:saham|posisi|pasar|emiten)\\b",
    alasan: "masuk/keluar posisi = waktu bertransaksi. Bentuk telanjang 'keluar sekarang' sengaja TIDAK didaftar karena bentrok dengan 'laporan kuartal 2 baru keluar sekarang'",
  },
  {
    label: "tahan dulu",
    pola: "\\b(?:tahan|nahan)\\s+(?:dulu|saja|aja)\\b|\\btahan\\s+sampai\\s+pulih\\b",
    alasan: "perintah menahan posisi. Bentuk pasif 'ditahan bursa sampai pengumuman' tidak ikut karena tanpa batas kata di depan",
  },
  {
    label: "alihkan dana",
    pola: "\\b(?:alihkan|pindahkan|titipkan|parkirkan)\\s+(?:dana|modal|uang|duit)(?:nya|mu|ku)?\\b",
    alasan: "perintah memindahkan dana pengguna. Frasa nomina 'alokasi dana hasil rights issue' tidak ikut karena tanpa verba perintah",
  },
  {
    label: "kurangi porsi",
    pola: "\\b(?:kurangi|potong|habiskan|tambah)\\s+(?:porsi|eksposur|kepemilikan|posisi)(?:nya|mu|ku)?\\b",
    alasan: "menyetel porsi kepemilikan pengguna. 'bobot' sengaja TIDAK di sini karena 'kurangi bobot blok jatuh_dari_puncak' adalah usulan alarm yang sah",
  },
  {
    label: "akumulasi bertahap",
    pola: "\\bakumulasi\\s+(?:bertahap|pelan|dulu|saja|sekarang)\\b|\\bakumulasikan\\b",
    alasan: "menambah posisi bertahap. Kata 'akumulasi' telanjang tidak didaftar karena 'akumulasi kerugian' adalah istilah laporan keuangan",
  },
  {
    label: "menunggu di luar",
    pola: "\\bmenunggu\\s+di\\s+luar\\b",
    alasan: "berada di luar pasar = keputusan posisi; 'menunggu sampai laporan terbit' tidak ikut",
  },

  // --- C. Posisi/uang pengguna yang disebut dengan kata ganti orang kedua -
  // "portofoliomu" TIDAK di sini: menyebut portofolio pengguna itu wajar dan
  // dipakai mode jaga ("TELE di portofoliomu berstatus kuning").
  {
    label: "porsimu",
    pola: "\\b(?:porsi|posisi|eksposur|lot|bobot|kepemilikan)mu\\b",
    alasan: "alat ini tidak punya data porsi/posisi pengguna, jadi menyebutnya selalu karangan model tentang keputusan investasi",
  },
  {
    label: "uangmu",
    pola: "\\b(?:uang|duit|dana|modal)mu\\b",
    alasan: "mengarahkan uang pengguna; alat ini tidak punya datanya",
  },
  { label: "cuanmu", pola: "\\bcuanmu\\b|\\bcuan\\s+(?:kamu|anda)\\b", alasan: "hasil transaksi pengguna" },

  // --- D. Pengandaian keputusan pengguna ---------------------------------
  {
    label: "kalau saya jadi kamu",
    pola: "\\bkalau\\s+(?:saya|aku)\\s+(?:jadi|di\\s+posisi)\\s+(?:kamu|anda|kalian)\\b",
    alasan: "selalu mendahului keputusan posisi orang lain",
  },
] as const;

/**
 * Few-shot negatif untuk lapis 1. Jauh lebih efektif daripada penyaring:
 * setiap baris memasangkan bentuk yang DILARANG dengan bentuk BENAR yang
 * menyampaikan informasi yang sama dari data.
 */
export const CONTOH_NEGATIF: readonly { salah: string; benar: string }[] = [
  {
    salah: "Sebaiknya kurangi porsimu di TELE sekarang.",
    benar: "Ekuitas TELE minus Rp1,1 triliun pada kuartal 4 2019, jadi blok ekuitas_negatif ambang longgar akan berbunyi 4 bulan sebelum kejadian target.",
  },
  {
    salah: "Saham ini sudah tidak layak dipegang.",
    benar: "Emiten ini memenuhi 3 dari 3 syarat alarmmu pada 30 Juni 2021 (suspensi, laporan hilang, ekuitas negatif).",
  },
  {
    salah: "Cut loss saja sebelum makin dalam.",
    benar: "Suspensi berjalan 14 bulan tanpa satu pun laporan kuartal baru (data suspensi, mulai 18 Mei 2021).",
  },
  {
    salah: "Menurut kami harganya akan rebound.",
    benar: "Alat ini tidak menilai harga; yang kami punya hanya tanggal kejadian dan angka laporan keuangan.",
  },
] as const;

const daftarContohNegatif = CONTOH_NEGATIF.map((c) => `- JANGAN: "${c.salah}"  →  TULIS: "${c.benar}"`).join("\n");

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
1. Kamu TIDAK PERNAH memberi rekomendasi jual-beli. Yang DILARANG bukan sekadar sederet kata, melainkan seluruh POKOK BAHASAN: jangan menyinggung membeli, menjual, menahan, menambah, mengurangi, atau mengalihkan posisi, porsi, lot, dana, atau modal pengguna; jangan menyebut waktu bertransaksi; jangan menilai layak-tidaknya sebuah emiten dipegang atau dilepas; jangan menilai atau meramal harga ("masih menarik", "prospeknya cerah", "berpotensi naik", "akan rebound", "harga wajarnya"). Larangan ini berlaku untuk SEMUA bentuk kalimat — perintah telanjang, deklaratif, pertanyaan retoris, satu butir daftar berpoin — dan tidak bisa dibatalkan dengan pengingkar di depannya ("ini bukan saran, tapi …"). Kata dan frasa yang jelas melanggar antara lain: ${KATA_TERLARANG.map((k) => `"${k}"`).join(", ")}; membingkainya sebagai anjuran (${KATA_ANJURAN.map((k) => `"${k}"`).join(", ")}) terhadap posisi atau dana pengguna juga dilarang. Anggap DIRIMU satu-satunya penjaga aturan ini: penyaring frasa di hilir hanya cadangan sempit, tidak menangkap semua bentuk, dan tidak pernah menjadi alasan untuk menulis kalimat beranjuran.
1b. Yang justru MENJADI TUGASMU: (a) menjelaskan FAKTA dari data — tanggal suspensi, kuartal laporan yang hilang, rasio rights issue, ekuitas, filing orang dalam — dan (b) mengusulkan perubahan pada ATURAN ALARM (menambah, menghapus, mengetatkan, atau melonggarkan blok; mengubah ambang longgar/ketat; mengubah cara gabung any/all) serta LANGKAH PEMERIKSAAN (menjalankan uji ke masa lalu lagi, memeriksa emiten tertentu, membaca pengumuman atau laporan sumbernya). Kalimat seperti "sebaiknya tambahkan blok suspensi", "ambang ketat belum cocok untuk emiten yang datanya cuma dua kuartal", dan "jumlah temuan akan naik dari 26 menjadi 41" adalah keluaran yang BENAR dan diharapkan — subjeknya aturan alarm, bukan posisi pengguna.
1c. Contoh:
${daftarContohNegatif}
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
- Kalimat meminta rekomendasi atau prediksi harga ("saham apa yang bakal naik", "beli apa", "jual sekarang?"): jelaskan bahwa alat ini hanya membuat peringatan berbasis data, bukan saran investasi. Pesan penolakanmu sendiri juga wajib mematuhi butir 1 — tolak tanpa menyelipkan pendapat tentang emiten atau posisi pengguna.
- Kalimat tidak bisa dipetakan ke satu pun blok yang tersedia (mis. minta pantau harga emas).
Saat menolak, isi rule dan alasan dengan null. Saat menerima, isi ditolak = false, pesan = null, rule sesuai skema, dan alasan = satu kalimat awam kenapa blok itu dipilih — tentang blok dan datanya, bukan tentang apa yang sebaiknya dilakukan pengguna terhadap sahamnya.`;

export const INSTRUKSI_DIAGNOSIS = `${INSTRUKSI_DASAR}

Tugasmu: DIAGNOSIS ALARM. Kamu menerima satu aturan alarm dan hasil uji-ke-masa-lalu (backtest) pada sekumpulan emiten: emiten "kena" (delisting/watchlist, punya tanggal kejadian target) dan emiten "kontrol" sehat. Beberapa emiten kena TERLEWAT (alarm tidak berbunyi sebelum kejadian target). Jelaskan KENAPA alarm bolong pada emiten terlewat dan usulkan perbaikan.

Cara kerja:
1. Panggil \`listMissed\` untuk melihat emiten kena yang terlewat (utamakan kasus nyata: TELE, WIKA, SRIL; GOLL kejadiannya sebelum 2020 sehingga di luar jangkauan data).
2. Untuk emiten terlewat yang kamu bahas, tarik data mentahnya dengan tool: \`getSuspensions\`, \`getReportDates\`, \`getFilings\`, \`getCorporateActions\`, \`getFinancials\`. Gunakan \`runAlarmOn\` untuk mengecek apakah aturan (atau blok tertentu) berbunyi pada tanggal t tertentu (akhir bulan sebelum kejadian target).
3. Simpulkan sebab bolong berdasarkan data: mis. suspensi terjadi di bulan yang sama dengan target sehingga tidak sempat terdengar; laporan kuartal masih lengkap sampai sesaat sebelum target; ekuitas masih positif; dsb. Sebutkan tanggal buktinya.
4. Usulkan MAKSIMAL 2 blok tambahan atau pengetatan (kind + threshold) yang menurut data akan menangkap emiten itu lebih awal, dengan alasan singkat berbasis fakta yang kamu lihat. Jika tidak ada blok yang bisa menolong (data tidak cukup), katakan demikian dan usulanBlok boleh kosong.
5. Batas pokok bahasan (butir 1): setiap kalimatmu bersubjek DATA atau ATURAN ALARM. Boleh menyebut angka akibat perubahan aturan ("jumlah temuan akan naik dari 26 menjadi 41"), keterbatasan blok ("blok insider_jual tidak cocok dipakai untuk kejadian sebelum 2024"), dan bobot blok di dalam kombinasi. TIDAK boleh menyebut apa yang sebaiknya pengguna lakukan terhadap sahamnya, porsinya, atau dananya — walau pengguna memintanya, walau kamu mendahuluinya dengan pengingkar.

Hemat langkah: kamu punya paling banyak 8 langkah; panggil beberapa tool sekaligus dalam satu langkah bila bisa. Jawaban akhir mengikuti skema yang diminta: ringkasan (2–4 kalimat awam), emitenDibahas (symbol, sebab, buktiTanggal), usulanBlok (maks 2).`;

/** Instruksi ringan untuk penjelasan harian (model sonnet). */
export const INSTRUKSI_PENJELASAN = `${INSTRUKSI_DASAR}

Tugasmu: menjelaskan satu kejadian alarm kepada pengguna awam dalam 2–3 kalimat, menyebut tanggal dan blok yang berbunyi, ditutup dengan kalimat "${DISCLAIMER}"`;
