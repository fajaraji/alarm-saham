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

// ===========================================================================
// SUBJEK klausa — inti penyensor saran investasi (tiket 15 putaran 4).
//
// Yang menentukan sebuah klausa dibuang atau tidak HANYA subjeknya, bukan
// ada-tidaknya kata pembingkai ("sebaiknya", "saran", "kamu harus"). Sampai
// putaran 3 syarat bingkai masih wajib (`bingkai && pasar`), dan akibatnya
// bentuk anjuran yang PALING lazim dalam Bahasa Indonesia santai — register
// yang justru diminta INSTRUKSI_DASAR butir 3 — lolos utuh, karena bentuk itu
// adalah perintah telanjang tanpa satu pun kata bingkai: "lepas saja selagi
// bisa", "kurangi bobotnya", "keluar dulu dari posisi ini", "alihkan dananya
// ke yang lain".
//
// Tiga keluarga pola bekerja bersama-sama (lihat guard.ts `nilaiKlausa`):
//   POLA_SUBJEK_PASAR → klausa tentang EFEK/POSISI/UANG PENGGUNA → DIBUANG
//   POLA_SUBJEK_ALARM → klausa tentang KONFIGURASI ALARM/PEMERIKSAAN → SELAMAT
//   POLA_PELAKU_DATA  → klausa LAPORAN FAKTA berpelaku pihak ketiga → SELAMAT
// ===========================================================================

/**
 * Objek yang HANYA masuk akal sebagai milik pengguna: posisi, porsi, dan uang.
 * Kata-kata ini tidak muncul di kalimat fakta pemindai, sehingga aman
 * dipasangkan bahkan dengan verba netral.
 */
const OBJEK_MILIK =
  "posisi|eksposur|porsi|bobot|kepemilikan|portofolio|dana|modal|uang|duit|cuan|lot|deposito|obligasi|reksadana";

/**
 * Objek efek secara umum. "saham" dan "emiten" (termasuk kode emiten yang
 * dinormalkan guard.ts) SANGAT sering muncul di kalimat fakta dan usulan blok
 * ("emiten TELE tertangkap 4 bulan lebih awal"), jadi keduanya hanya sah
 * sebagai bukti bila dipasangkan dengan verba yang murni transaksi.
 */
const OBJEK_EFEK = `saham|emiten|${OBJEK_MILIK}`;

/**
 * Verba yang murni transaksi efek — di domain ini tidak punya pemakaian lain.
 * Bentuk berimbuhan me-/di- ikut karena anjuran pasif juga lazim ("sahamnya
 * sebaiknya dilepas"); kalimat BERITA yang memakai bentuk yang sama
 * ("orang dalam melepas sahamnya") diselamatkan POLA_PELAKU_DATA.
 */
const VERBA_PASAR =
  "lepas|lepaskan|melepas|dilepas|jual|menjual|dijual|beli|membeli|dibeli|serok|borong|memborong|" +
  "akumulasi|akumulasikan|distribusikan|pegang|memegang|dipegang|tahan|menahan|ditahan|buang|buangkan";

/**
 * Verba netral: sah dipakai untuk menyetel alarm ("tambah satu blok",
 * "kurangi ambangnya"), jadi hanya berarti anjuran investasi bila objeknya
 * milik pengguna. Hanya bentuk perintah/akar yang didaftar — bentuk pasif
 * ("setelah blok ditambah, TELE tertangkap lebih awal") justru kalimat kerja
 * agent diagnosis dan tidak boleh ikut kena.
 *
 * "tambahkan"/"menambahkan" tidak ikut dengan sendirinya: `\btambah\b` tidak
 * cocok dengan "tambahkan", sehingga "tambahkan blok suspensi" — usulan alarm
 * yang paling sering ditulis agent diagnosis — aman.
 */
/**
 * Bentuk me- dari verba netral. Bentuk ini dipakai baik untuk aturan alarm
 * ("kalau kamu menambah blok suspensi") maupun untuk posisi ("sebaiknya kamu
 * tidak menambah SRIL lagi"), jadi ia hanya jadi bukti lewat pola P2c yang
 * memeriksa objek TERDEKATNYA.
 */
const VERBA_NETRAL_ME =
  "menambah|mengurangi|memotong|memindahkan|mengalihkan|menyimpan|mempertahankan|menaruh|menempatkan|memarkir";

const VERBA_NETRAL =
  "kurangi|tambah|naikkan|turunkan|potong|alihkan|pindahkan|pertahankan|amankan|realisasikan|cairkan|geser|" +
  // Menempatkan uang: "jangan menaruh uang di emiten seperti ini", "taruh
  // dananya di deposito". Objeknya wajib milik pengguna, jadi "menaruh catatan"
  // atau "tempatkan blok" tidak ikut kena.
  "taruh|menaruh|tempatkan|menempatkan|parkir|memarkir";

/**
 * Verba yang HANYA masuk akal untuk transaksi efek, sehingga sebagai perintah
 * telanjang di awal klausa ia sudah cukup jadi bukti — tanpa objek sekalipun
 * ("Lepas saja pelan-pelan sebelum laporan kuartal berikutnya.").
 */
const VERBA_PERINTAH_PASAR =
  "lepas|lepaskan|jual|juallah|beli|belilah|serok|borong|akumulasi|akumulasikan|distribusikan|amankan|realisasikan|cairkan|sikat";

/**
 * Awal klausa: spasi, tanda kutip/kurung, penanda daftar berpoin ("- ", "• ",
 * "1. "), dan kata sambung/partikel yang lazim mendahului perintah telanjang.
 * Tanpa ini, anjuran di dalam daftar berpoin dan sesudah pengingkar ("…, tapi
 * lepas saja") tidak terbaca sebagai perintah.
 */
const SAMBUNG =
  "tapi|tetapi|namun|melainkan|lalu|kemudian|terus|baru|jadi|maka|dan|atau|sekalian|mending|mendingan|" +
  "langsung|pokoknya|ya|nah|coba|tolong|segera|sebaiknya|silakan|silahkan|ayo|yuk|jangan|mungkin";
const AWAL_KLAUSA = `^[\\s"'“”(\\[•*·—–-]*(?:\\d+[.)]\\s*)?(?:(?:${SAMBUNG})[\\s,]+)*`;

/**
 * Posisi tempat perintah telanjang boleh muncul: awal klausa, atau sesudah
 * koma/titik dua yang diikuti kata sambung ("Perketat ambangnya, lalu lepas
 * sisanya"). Tanpa cabang kedua, anjuran yang ditempel di belakang usulan
 * alarm yang sah tidak terbaca sebagai perintah.
 */
const PEMBUKA_PERINTAH = `(?:${AWAL_KLAUSA}|[,:]\\s*(?:(?:${SAMBUNG})[\\s,]+)+)`;

/** Jendela antar-kata di dalam SATU klausa (pemenggal tidak boleh terlompati). */
const JEDA = "[^.!?;\\n]{0,45}?";

/**
 * Dua kelompok kata yang muncul di klausa yang sama, urutan bebas — dipakai
 * untuk "verba transaksi + objek pasar". Urutan bebas karena keduanya lazim:
 * "kurangi porsimu" dan "porsimu sebaiknya dikurangi".
 */
function pasangan(verba: string, objek: string): RegExp {
  const o = `\\b(?:${objek})(?:nya|mu|ku)?\\b`;
  const v = `\\b(?:${verba})\\b`;
  return new RegExp(`${v}${JEDA}${o}|${o}${JEDA}${v}`, "i");
}

/**
 * PERINTAH/AJAKAN bertransaksi: klausa yang BENTUKNYA sendiri sudah anjuran
 * kepada pengguna. Dipisah dari daftar besar karena punya satu kewenangan
 * tambahan di guard.ts: ia membatalkan pengecualian POLA_PELAKU_DATA. Kalimat
 * "orang dalam sudah keluar, jadi lepas saja punyamu" menyebut pelaku pihak
 * ketiga, tetapi jelas bukan laporan data.
 */
export const POLA_PERINTAH_PASAR: readonly RegExp[] = [
  // (P1) Perintah transaksi telanjang. Bentuk anjuran paling ringkas dalam
  //      bahasa sehari-hari, dan bentuk yang lolos utuh sampai putaran 3.
  //      "lepas dari itu" (idiom "selain itu") dikecualikan supaya kalimat
  //      pengantar tidak ikut kena.
  new RegExp(`${PEMBUKA_PERINTAH}(?:${VERBA_PERINTAH_PASAR})\\b(?!\\s+dari\\s+itu)`, "i"),
  // (P3) Larangan/perintah negatif: "jangan simpan SRIL lagi", "jangan dilepas",
  //      "tidak usah tambah dulu".
  /\b(jangan|tidak usah|nggak usah|gak usah|stop|berhenti)\s+(simpan|menyimpan|disimpan|pegang|memegang|dipegang|tahan|menahan|ditahan|beli|membeli|dibeli|jual|menjual|dijual|tambah|menambah|nambah|masuk|keluar|lepas|melepas|dilepas|borong|serok)\b/i,
  // (P4) Menahan posisi — "tahan dulu", "tahan sampai pulih", "simpan saja
  //      dulu". "tunggu/menunggu" dipisah dan TIDAK boleh dipasangkan dengan
  //      "sampai": "menunggu sampai laporan terbit" kalimat fakta, bukan
  //      anjuran. Bentuk pasif "disimpan" juga tidak ikut, supaya kalimat
  //      teknis ("data disimpan sementara") tidak kena.
  /\b(tahan|ditahan|menahan|nahan|pegang|dipegang|simpan)\s+(dulu|saja|aja|sampai|sementara)\b/i,
  /\b(tunggu|menunggu|wait)\s+(dulu|saja|aja|di\s+luar)\b/i,
  // (P5) Masuk/keluar posisi berikut waktunya. "keluar dulu", "masuk sekarang".
  //      Lookbehind menahan kalimat fakta yang subjeknya dokumen, bukan posisi
  //      ("laporan kuartal 2 baru keluar sekarang"); jendela 3 kata menampung
  //      keterangan di antaranya. "lagi", "besok", dan "minggu ini" tidak
  //      didaftar karena "laporannya tidak keluar lagi" jauh lebih sering
  //      daripada "masuk lagi" — bentuk anjurannya sudah tertangkap "keluar
  //      dulu"/"masuk sekarang" di kalimat yang sama.
  /(?<!\b(?:laporan|laporannya|pengumuman|filing|hasil|data|angka|kabar|berita|uji)\s(?:\w+\s){0,3})\b(masuk|keluar)\s+(sekarang|dulu|saja|aja|bertahap|pelan|selagi)\b/i,
  /\b(masuk|keluar|cabut|menyingkir|hengkang|angkat kaki)\s+(dari|ke)\s+(saham|posisi|pasar|emiten)\b/i,
  // (P6) Pindah ke efek lain — "cari saham lain", "pindahkan ke saham bank yang
  //      lebih aman". Ekornya wajib "lain/lainnya/pengganti" atau "yang lebih"
  //      + kata sifat penilaian; tanpa syarat itu, langkah pemeriksaan yang sah
  //      ("cari emiten pembanding", "emiten yang lebih dulu disuspensi") ikut
  //      termakan.
  /\b(cari|mencari|pindah|pindahkan|memindahkan|dipindahkan|beralih|ganti|tukar|alihkan|mengalihkan|dialihkan|taruh|menaruh|tempatkan|switching|switch)\b[^.!?;\n]{0,30}\b(saham|emiten)(nya)?\s+[^.!?;\n]{0,15}?(lain|lainnya|pengganti|yang\s+lebih\s+(sehat|aman|baik|bagus|tertib|likuid|murah|kuat))\b/i,
  // (P12) Menghindari efek tertentu ("hindari SRIL", "hindari emiten seperti
  //       ini") — berbeda dari "hindari ambang terlalu ketat" yang soal alarm.
  /\bhindari\b[^.!?;\n]{0,25}\b(saham|emiten)\b/i,
  // (P13) "Kalau saya jadi kamu …" selalu tentang keputusan posisi orang lain.
  /\bkalau\s+(saya|aku)\s+jadi\s+(kamu|anda|kalian)\b/i,
] as const;

/**
 * SUBJEK "efek/posisi/uang pengguna": klausa yang subjeknya ini adalah saran
 * investasi dan WAJIB dibuang (aturan lomba (b)) — apa pun bentuk kalimatnya:
 * imperatif telanjang, deklaratif, pertanyaan retoris, sesudah pengingkar, atau
 * satu butir di dalam daftar berpoin. Pengingkar tidak pernah menyelamatkan
 * klausa bersubjek pasar; ia hanya melindungi dirinya sendiri (guard.ts
 * FRASA_DILINDUNGI).
 */
export const POLA_SUBJEK_PASAR: readonly RegExp[] = [
  ...POLA_PERINTAH_PASAR,
  // (P2a) Verba murni transaksi + objek efek: "memegang SRIL", "sahamnya
  //       sebaiknya dilepas". Kalimat berita berpelaku pihak ketiga tetap aman
  //       lewat POLA_PELAKU_DATA.
  pasangan(VERBA_PASAR, OBJEK_EFEK),
  // (P2b) Verba netral + objek MILIK PENGGUNA: "kurangi bobotnya", "porsimu
  //       potong separuh", "alihkan dananya". Verba yang sama tanpa objek milik
  //       ("kurangi ambangnya", "tambah satu blok untuk TELE") tidak kena.
  pasangan(VERBA_NETRAL, OBJEK_MILIK),
  // (P2c) Verba netral bentuk me- + objek efek TERDEKAT. Yang membedakan
  //       "sebaiknya kamu tidak menambah SRIL lagi" (anjuran posisi) dari
  //       "kalau kamu menambah blok suspensi, TELE tertangkap lebih awal"
  //       (usulan aturan) adalah kata tepat sesudah verbanya, bukan seluruh
  //       isi klausa — jadi istilah alarm di posisi itu menggugurkan pola.
  new RegExp(
    `\\b(?:${VERBA_NETRAL_ME})\\s+(?!(?:blok|ambang|aturan|alarm|threshold|kombinasi|uji|pemantauan|syarat|catatan|data)\\b)` +
      `(?:\\w+\\s+){0,2}?(?:${OBJEK_EFEK})(?:nya|mu|ku)?\\b`,
    "i",
  ),
  // (P7) Istilah transaksi yang tidak punya makna lain di luar pasar.
  /\b(cut\s*loss|stop\s*loss|take[\s-]?profit|average\s*(down|up)|averaging|switching)\b/i,
  /\bmenunggu\s+di\s+luar\b/i,
  // (P8) Harga/target dan waktu bertransaksi sebagai ajakan.
  // Akhiran -nya wajib ikut: "harga wajarnya 120" adalah bentuk yang paling
  // sering ditulis model, dan `\bwajar\b` tidak cocok dengan "wajarnya".
  /\b(harga|target)\s+(beli|jual|masuk|keluar|wajar|atas|bawah)(nya|mu)?\b/i,
  /\b(selagi|mumpung)\s+(murah|mahal|bisa|sempat|masih|belum)\b/i,
  /\b(cuan|untung|rugi)(nya|mu)?\s+(bisa|akan|lebih|makin)\b/i,
  // (P9) Penilaian layak/tidak layak dibeli atau dipegang.
  /\b(layak|cocok|aman|bagus|pantas)\s+(dibeli|dikoleksi|dipegang|disimpan|dipertahankan|ditahan|dilirik|masuk|untuk\s+investasi|buat\s+investasi)\b/i,
  /\b(tidak|belum|kurang|nggak|gak)\s+(layak|cocok|pantas)\b/i,
  // "berisiko" sengaja TIDAK di sini: "emiten ini berisiko delisting" adalah
  // pesan inti alat ini, bukan penilaian layak-tidaknya sebagai investasi.
  /\b(saham|emiten)\s+ini\s+(bagus|jelek|buruk|aman|berbahaya|menguntungkan)\b/i,
  // (P10) Uang pengguna diarahkan ke tempat lain.
  /\b(dana|modal|uang|duit)(nya|mu|ku)?\s+[^.!?;\n]{0,25}(lebih\s+(aman|baik|berguna)|(di|ke)\s+tempat\s+lain)\b/i,
  /\balokasi\s+(dana|modal|aset|portofolio)\b/i,
  // (P11) Porsi/portofolio pengguna dinilai atau diperintahkan.
  /\b(posisi|porsi|bobot|eksposur|portofolio|kepemilikan)(nya|mu|ku)?\s+[^.!?;\n]{0,25}\b(terlalu|kebesaran|kegedean|sebaiknya|seharusnya|jangan|wajib|harus|mesti)\b/i,
] as const;

/**
 * PELAKU DATA: pihak ketiga yang melakukan transaksi di dalam kalimat BERITA
 * ("orang dalam melepas sahamnya", "asing menjual bersih", "broker ritel
 * membeli"). Klausa seperti ini fakta dari data, bukan anjuran, dan wajib
 * selamat walau memuat kata jual/beli.
 *
 * Pengecualiannya batal begitu klausa itu juga berbicara KEPADA pengguna
 * (POLA_ORANG_KEDUA) atau berbentuk perintah telanjang — di situ faktanya cuma
 * pengantar anjuran ("orang dalam sudah keluar, kamu lepas juga").
 */
export const POLA_PELAKU_DATA: readonly RegExp[] = [
  // Pelaku transaksi di data filing.
  /\b(orang dalam|insider|direksi|komisaris|pengendali|manajemen|pemegang saham)\b/i,
  /\b(institusi|institusional|asing|broker|ritel|bandar|publik|reksa\s?dana)\b/i,
  /\bfiling\b/i,
  // Pelaku tindakan bursa ("perdagangannya ditahan bursa sampai pengumuman").
  /\b(bursa|otoritas|regulator|ojk|idx|bei)\b/i,
] as const;

/**
 * Penanda klausa yang berbicara KEPADA pengguna atau tentang milik pengguna.
 * Dipakai hanya untuk membatalkan pengecualian POLA_PELAKU_DATA — bukan untuk
 * membuang kalimat, karena "alarmmu" dan "aturanmu" justru subjek yang sah.
 */
export const POLA_ORANG_KEDUA: readonly RegExp[] = [
  /\b(kamu|kau|anda|kalian)\b/i,
  /\b(posisi|porsi|bobot|eksposur|portofolio|kepemilikan|saham|dana|modal|uang|cuan)(mu|ku)\b/i,
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
