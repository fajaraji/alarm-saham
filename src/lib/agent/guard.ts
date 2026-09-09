// Filter keamanan keluaran model: membuang ANJURAN INVESTASI dari teks yang
// ditulis model, tanpa ikut membuang usulan penyetelan alarm — yang justru
// tugas agent diagnosis (INSTRUKSI_DIAGNOSIS: "usulkan perbaikan", usulanBlok[]).
//
// Aturannya berdasarkan SUBJEK klausa saja — bingkai anjuran ("sebaiknya",
// "saran saya", "kamu harus") BUKAN syarat wajib:
//
//   DIBUANG  — subjeknya efek/posisi/uang pengguna: membeli, menjual, menahan,
//              menambah/mengurangi/melepas posisi, masuk/keluar, cut loss,
//              average down, switching, alokasi atau pengalihan dana, bobot
//              portofolio, target/harga wajar sebagai ajakan, penilaian layak
//              atau tidak layak dibeli/dipegang, waktu bertransaksi. Berlaku
//              untuk SEMUA bentuk kalimat: imperatif telanjang ("lepas saja
//              selagi bisa"), deklaratif, pertanyaan retoris, satu butir daftar
//              berpoin, dan sesudah pengingkar — pengingkar hanya melindungi
//              dirinya sendiri, tidak pernah sisa klausanya.
//   SELAMAT  — subjeknya konfigurasi alarm atau langkah pemeriksaan: menambah,
//              menghapus, memperketat atau melonggarkan blok; mengubah ambang;
//              menjalankan uji ulang; memeriksa emiten; membaca dokumen sumber;
//              menyalakan pemantauan. Ini keluaran SAH agent diagnosis.
//   SELAMAT  — kalimat FAKTA berpelaku pihak ketiga walau memuat kata
//              jual/beli: "filing jual oleh orang dalam", "asing menjual
//              bersih", "broker ritel membeli".
//   CAMPUR   — klausa yang menyentuh pasar dan konfigurasi sekaligus dibuang
//              (pilihan aman), tetapi hanya klausa itu; tetangganya tidak ikut.
//   RAGU     — klausa beranjuran kepada pengguna yang subjeknya tidak jelas
//              pasar ("sebaiknya kamu segera bertindak") DIPERTAHANKAN supaya
//              fitur inti tidak rusak, tetapi dihitung di `kalimatRagu`
//              sehingga pemanggil tetap menandainya perlu ditinjau.
//
// Tiga putaran sebelumnya salah bergantian di kedua arah:
//   * frasa pelindung pengingkar berakhir `[^.!?;\n]*` (rakus sampai akhir
//     klausa), sehingga "Bukan rekomendasi ya, tapi sebaiknya jual TELE hari
//     ini." lolos UTUH — seluruh sisa klausa tersembunyi di balik sentinel;
//   * kata telanjang "seharusnya"/"disarankan"/"saran"/"rekomendasi" membuang
//     kalimat tanpa melihat subjeknya, sehingga "Ambang ekuitas negatif
//     seharusnya dilonggarkan agar TELE tertangkap." dan fakta "Laporan kuartal
//     2 seharusnya terbit 31 Juli 2024" ikut hilang;
//   * syarat `bingkai && pasar` (putaran 3) meloloskan setiap perintah
//     telanjang — "kurangi bobotnya", "keluar dulu dari posisi ini", "alihkan
//     dananya ke yang lain" — termasuk sesudah pengingkar.
//
// Pemenggalan memakai . ! ? ; dan baris baru, sehingga klausa fakta di sebelah
// klausa anjuran ("ekuitas negatif; akumulasi disarankan") tetap selamat.
import {
  KATA_ANJURAN,
  KATA_TERLARANG,
  POLA_ANJURAN_BINGKAI,
  POLA_ANJURAN_MANDIRI,
  POLA_ORANG_KEDUA,
  POLA_PELAKU_DATA,
  POLA_PENGGANTI_ARAH,
  POLA_PENILAIAN,
  POLA_PERINTAH_PASAR,
  POLA_SUBJEK_ALARM,
  POLA_SUBJEK_PASAR,
  POLA_TOLAK_RAMALAN,
} from "./instructions";

/**
 * Frasa yang harus kebal penyaring.
 *
 * Dua jenis:
 *   1. frasa faktual yang memuat kata "jual"/"beli" tetapi bukan ajakan (nama
 *      blok `insider_jual`, "filing jual", "transaksi jual" dari mesin uji);
 *   2. pengingkar yang justru wajib ada ("bukan saran investasi") — tanpa ini
 *      disclaimer wajib PLAN §2 tersensor oleh polanya sendiri.
 *
 * Pola pengingkar BERHENTI tepat setelah kata yang diingkari. Versi sebelumnya
 * berakhir `[^.!?;\n]*` dan menelan sisa klausa, sehingga pola "sangkal dulu
 * lalu beri anjuran" — bentuk yang paling sering ditulis model — lolos utuh.
 */
const FRASA_DILINDUNGI = [
  /insider_jual/gi,
  /\bfiling jual\b/gi,
  /\btransaksi jual\b/gi,
  /\btransaksi beli\b/gi,
  /\btipe jual\b/gi,
  /\btipe beli\b/gi,
  /\borang dalam jual\b/gi,
  /\bjual orang dalam\b/gi,
  /\bbukan\s+(saran|rekomendasi|anjuran|nasihat)(\s+investasi)?\b/gi,
  /\btidak\s+(memberi|memberikan|mengandung|ada)\s+(saran|rekomendasi|anjuran|nasihat)(\s+investasi)?\b/gi,
  /\btanpa\s+(saran|rekomendasi|anjuran|nasihat)(\s+investasi)?\b/gi,
];

const PENGGANTI = "[dihapus]";
export const PENGGANTI_KALIMAT = "[kalimat saran dihapus]";
// Penanda sementara untuk frasa terlindung; karakter kontrol tidak pernah
// muncul di teks model sehingga tidak bentrok dengan angka biasa.
const SENTINEL = String.fromCharCode(1);
const POLA_SENTINEL = new RegExp(SENTINEL + "([0-9]+)" + SENTINEL, "g");

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function polaKata(kata: string): RegExp {
  // Kata berimbuhan (menjual, dijual, pembelian) TIDAK ikut tersensor karena
  // \b menuntut batas kata di kedua sisi. Frasa multi-kata: spasi fleksibel.
  const inti = kata.trim().split(/\s+/).map(escapeRegex).join("\\s+");
  return new RegExp(`\\b${inti}\\b`, "gi");
}

const POLA_TERLARANG = KATA_TERLARANG.map((k) => ({ kata: k, pola: polaKata(k) }));
/** Semua kata pembingkai anjuran yang disebut instruksi sistem. */
const POLA_ANJURAN = KATA_ANJURAN.map((k) => polaKata(k));
/** Bingkai yang menandai klausa BERBENTUK anjuran (kata + pola berorang kedua). */
const POLA_BINGKAI = [...POLA_ANJURAN_MANDIRI.map((k) => polaKata(k)), ...POLA_ANJURAN_BINGKAI];
/** Pemenggal kalimat/klausa: titik, tanya, seru, titik koma, baris baru. */
const PEMENGGAL = /([.!?;\n]+)/;

export interface HasilSensor {
  teks: string;
  /** Kata terlarang yang ditemukan (huruf kecil, unik). */
  kata: string[];
  /**
   * Berapa kalimat/klausa yang dibuang seluruhnya. Bisa > 0 walau `kata` kosong
   * (anjuran pasar tanpa kata terlarang); pemanggil WAJIB memperlakukan ini sama
   * seriusnya dengan `kata`, kalau tidak teks model yang sudah bolong akan
   * dikirim ke pengguna seolah bersih.
   */
  kalimatDibuang: number;
  /**
   * Klausa yang DIPERTAHANKAN karena subjeknya tidak jelas pasar, tetapi tetap
   * mencurigakan (beranjuran, berorang kedua, bukan soal alarm). Teksnya utuh —
   * angkanya ada supaya lapis lain masih bisa menandai keluarannya perlu
   * ditinjau, bukan supaya kalimatnya dibuang.
   */
  kalimatRagu: number;
}

/** Hasil penilaian satu klausa — dipakai sensorTeks dan diuji langsung. */
export interface NilaiKlausa {
  /** Klausa berbentuk anjuran (bingkai "sebaiknya", "kamu harus", …). */
  bingkai: boolean;
  /** Subjeknya efek/posisi/uang pengguna — inilah satu-satunya syarat buang. */
  pasar: boolean;
  /** Subjeknya konfigurasi alarm atau langkah pemeriksaan. */
  alarm: boolean;
  /** Laporan fakta berpelaku pihak ketiga ("asing menjual bersih"). */
  fakta: boolean;
  /** Klausa berbicara kepada pengguna ("kamu", "porsimu"). */
  orangKedua: boolean;
  /** Penilaian atau ramalan harga ("masih menarik", "berpotensi naik"). */
  penilaian: boolean;
  /** Klausa yang justru MENOLAK meramal ("saya tidak bisa menebak saham yang akan naik"). */
  tolakRamalan: boolean;
  /** Mencurigakan tetapi subjeknya tidak jelas pasar → dipertahankan + ditandai. */
  ragu: boolean;
}

/** `RegExp.test` dengan flag /g aman: lastIndex selalu dikembalikan ke 0. */
function cocok(pola: readonly RegExp[], teks: string): boolean {
  return pola.some((p) => {
    p.lastIndex = 0;
    return p.test(teks);
  });
}

/**
 * Ganti kode emiten (4 huruf kapital: TELE, SRIL, WIKA) dengan kata "emiten"
 * supaya pola subjek bisa memakai flag /i tanpa kehilangan kode emiten sebagai
 * objek anjuran: "Hindari SRIL." harus dinilai sama dengan "hindari emiten".
 * Hanya untuk PENILAIAN klausa — teks yang dikembalikan ke pengguna tidak
 * pernah dinormalkan. Kalimat yang seluruhnya HURUF KAPITAL bisa ikut terbaca
 * sebagai kode emiten; itu memihak ke arah aman (lebih banyak dibuang).
 */
function normalisasiEmiten(klausa: string): string {
  return klausa.replace(/\b[A-Z]{4}\b/g, " emiten ");
}

/** Klasifikasi satu klausa (tanpa melihat kata terlarang). Diekspor untuk tes. */
export function nilaiKlausa(klausa: string): NilaiKlausa {
  const t = normalisasiEmiten(klausa);
  const orangKedua = cocok(POLA_ORANG_KEDUA, t);
  const alarm = cocok(POLA_SUBJEK_ALARM, t);
  const bingkai = cocok(POLA_BINGKAI, t);
  // Perintah/ajakan bertransaksi membatalkan pengecualian fakta: "orang dalam
  // sudah keluar, lepas saja punyamu" bukan laporan data walau menyebut pelaku
  // pihak ketiga.
  const perintah = cocok(POLA_PERINTAH_PASAR, t);
  const fakta = cocok(POLA_PELAKU_DATA, t) && !orangKedua && !perintah;
  const pasar = cocok(POLA_SUBJEK_PASAR, t) && !fakta;
  const penilaian = cocok(POLA_PENILAIAN, t);
  return {
    bingkai,
    pasar,
    alarm,
    fakta,
    orangKedua,
    penilaian,
    // Menolak meramal ≠ meramal — tetapi begitu ada kata sambung pertentangan
    // ("tidak bisa meramal, TAPI SRIL akan naik") atau subjek pasar, pengecualian
    // ini batal; kalau tidak, pola "sangkal dulu lalu ramal" akan lolos.
    tolakRamalan: cocok(POLA_TOLAK_RAMALAN, t) && !POLA_PENGGANTI_ARAH.test(t) && !pasar,
    // Anjuran kepada pengguna yang subjeknya tidak jelas pasar DAN tidak jelas
    // alarm ("sebaiknya kamu segera bertindak"): pertahankan — membuangnya
    // berisiko memakan kalimat sah — tetapi tandai supaya bisa ditinjau.
    ragu: bingkai && orangKedua && !pasar && !alarm && !fakta && !penilaian,
  };
}

/** Sensor satu teks. */
export function sensorTeks(teks: string): HasilSensor {
  // 1. Lindungi frasa faktual & pengingkar dengan penanda yang tidak mengandung
  //    kata terlarang. Pengingkar hanya menutupi DIRINYA SENDIRI, bukan sisa
  //    klausanya, supaya "bukan saran, tapi sebaiknya jual X" tetap tersaring.
  const simpanan: string[] = [];
  let kerja = teks;
  for (const pola of FRASA_DILINDUNGI) {
    kerja = kerja.replace(pola, (m) => {
      simpanan.push(m);
      return `${SENTINEL}${simpanan.length - 1}${SENTINEL}`;
    });
  }
  // 2. Sensor per kalimat/klausa menurut SUBJEK anjurannya.
  const kena = new Set<string>();
  let dibuang = 0;
  let ragu = 0;
  const bagian = kerja.split(PEMENGGAL);
  const hasil = bagian.map((sepotong, i) => {
    if (i % 2 === 1) return sepotong; // pemenggal (tanda baca) — biarkan
    // Pertahankan spasi pembuka/penutup agar tanda baca tidak menempel aneh.
    const buang = () => {
      dibuang += 1;
      return `${/^\s*/.exec(sepotong)![0]}${PENGGANTI_KALIMAT}${/\s*$/.exec(sepotong)![0]}`;
    };
    // Kata terlarang dicatat lebih dulu — juga untuk klausa yang toh akan
    // dibuang, supaya `kata` tetap melaporkan apa yang sempat ditulis model.
    const kenaDiSini = new Set<string>();
    let disensor = sepotong;
    for (const { kata, pola } of POLA_TERLARANG) {
      disensor = disensor.replace(pola, () => {
        kenaDiSini.add(kata);
        return PENGGANTI;
      });
    }
    kenaDiSini.forEach((k) => kena.add(k));
    const n = nilaiKlausa(sepotong);

    // a. Penilaian/ramalan harga selalu tentang efek → buang, kecuali klausa
    //    yang justru MENOLAK meramal (penolakan sopan /rakit).
    if (n.penilaian && !n.tolakRamalan) return buang();

    // b. Kata terlarang telanjang (yang faktual sudah terlindung di langkah 1)
    //    adalah ajakan bertransaksi: buang klausanya, bukan sekadar katanya.
    //    Kecuali klausa yang jelas membicarakan KONFIGURASI ALARM dan tidak
    //    berbingkai anjuran maupun bersubjek pasar ("Blok suspensi berbunyi
    //    2021-05-18, lalu hold sampai jelas."): di sana katanya diganti supaya
    //    fakta di klausa itu tidak ikut hilang — dan `kata` yang terisi sudah
    //    membuat pemanggil menandai teksnya perlu ditinjau.
    if (kenaDiSini.size > 0) {
      const aman = n.alarm && !n.pasar && !cocok(POLA_ANJURAN, sepotong);
      return aman ? disensor : buang();
    }

    // c. SATU-SATUNYA syarat buang berikutnya: subjeknya efek/posisi/uang
    //    pengguna. Tidak perlu bingkai anjuran, tidak peduli bentuk kalimatnya,
    //    dan pengingkar di depannya tidak menolong. Klausa campur (pasar +
    //    konfigurasi alarm) ikut ke sini — hanya klausa itu, bukan tetangganya.
    if (n.pasar) return buang();

    // d. Subjek alarm, laporan fakta pihak ketiga, dan kalimat netral selamat
    //    utuh. Yang beranjuran ke pengguna tetapi subjeknya tidak jelas pasar
    //    dipertahankan juga, hanya dihitung sebagai ragu.
    if (n.ragu) ragu += 1;
    return sepotong;
  });
  kerja = hasil.join("");
  // 3. Kembalikan frasa terlindung (yang klausanya tidak dibuang).
  kerja = kerja.replace(POLA_SENTINEL, (_, i: string) => simpanan[Number(i)]);
  return { teks: kerja, kata: [...kena], kalimatDibuang: dibuang, kalimatRagu: ragu };
}

export interface HasilSensorObjek<T> {
  hasil: T;
  perluTinjau: boolean;
  kataDisensor: string[];
  /** Total kalimat/klausa yang dibuang di seluruh objek. */
  kalimatDibuang: number;
  /** Total klausa yang dipertahankan tetapi ditandai ragu di seluruh objek. */
  kalimatRagu: number;
}

/**
 * Sensor semua string di dalam objek/array secara rekursif, KECUALI kunci yang
 * disebut di `lewati` (mis. `kind`, `symbol` yang berasal dari data, bukan
 * karangan model). Mengembalikan salinan baru.
 */
export function sensorObjek<T>(nilai: T, lewati: readonly string[] = []): HasilSensorObjek<T> {
  const kena = new Set<string>();
  let dibuang = 0;
  let ragu = 0;
  const skip = new Set(lewati);
  const jalan = (v: unknown, kunci?: string): unknown => {
    if (typeof v === "string") {
      if (kunci && skip.has(kunci)) return v;
      const s = sensorTeks(v);
      s.kata.forEach((k) => kena.add(k));
      dibuang += s.kalimatDibuang;
      ragu += s.kalimatRagu;
      return s.teks;
    }
    if (Array.isArray(v)) return v.map((x) => jalan(x, kunci));
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, jalan(x, k)]));
    }
    return v;
  };
  const hasil = jalan(nilai) as T;
  // Klausa yang dibuang karena beranjuran (tanpa kata terlarang) sama seriusnya
  // dengan kata terlarang; klausa "ragu" tidak dibuang tetapi tetap menandai
  // keluaran model perlu ditinjau (aturan 6 koordinator putaran 4).
  return {
    hasil,
    perluTinjau: kena.size > 0 || dibuang > 0 || ragu > 0,
    kataDisensor: [...kena],
    kalimatDibuang: dibuang,
    kalimatRagu: ragu,
  };
}
