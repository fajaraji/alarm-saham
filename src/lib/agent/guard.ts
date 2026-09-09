// Filter keamanan keluaran model: membuang ANJURAN INVESTASI dari teks yang
// ditulis model, tanpa ikut membuang usulan penyetelan alarm — yang justru
// tugas agent diagnosis (INSTRUKSI_DIAGNOSIS: "usulkan perbaikan", usulanBlok[]).
//
// Aturannya berdasarkan SUBJEK anjuran, bukan kata kerjanya:
//
//   DIBUANG  — subjeknya efek/posisi/uang: membeli, menjual, menahan, menambah
//              atau mengurangi posisi, masuk/keluar, cut loss, average down,
//              alokasi dana, target harga, waktu transaksi, penilaian layak
//              atau tidak layak sebagai investasi. Pengingkar di depan kalimat
//              ("ini bukan saran, tapi sebaiknya lepas saham ini") TIDAK
//              menyelamatkan sisa klausanya.
//   SELAMAT  — subjeknya konfigurasi alarm atau langkah pemeriksaan: menambah,
//              menghapus, atau memperketat blok; mengubah ambang; menjalankan
//              uji ulang; memeriksa emiten tertentu; membaca dokumen sumber.
//   CAMPUR   — klausa yang menyentuh keduanya dibuang (pilihan aman), tetapi
//              hanya klausa itu; tetangganya tidak ikut.
//
// Dua putaran sebelumnya salah di kedua arah sekaligus:
//   * frasa pelindung pengingkar berakhir `[^.!?;\n]*` (rakus sampai akhir
//     klausa), sehingga "Bukan rekomendasi ya, tapi sebaiknya jual TELE hari
//     ini." lolos UTUH — seluruh sisa klausa tersembunyi di balik sentinel dan
//     kebal penyaring;
//   * kata telanjang "seharusnya"/"disarankan"/"saran"/"rekomendasi" membuang
//     kalimat tanpa melihat subjeknya, sehingga "Ambang ekuitas negatif
//     seharusnya dilonggarkan agar TELE tertangkap." dan fakta "Laporan kuartal
//     2 seharusnya terbit 31 Juli 2024" ikut hilang.
//
// Pemenggalan memakai . ! ? ; dan baris baru, sehingga klausa fakta di sebelah
// klausa anjuran ("ekuitas negatif; akumulasi disarankan") tetap selamat.
import {
  KATA_ANJURAN,
  KATA_TERLARANG,
  POLA_ANJURAN_BINGKAI,
  POLA_ANJURAN_MANDIRI,
  POLA_PENGGANTI_ARAH,
  POLA_PENILAIAN,
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
}

/** Hasil penilaian satu klausa — dipakai sensorTeks dan diuji langsung. */
export interface NilaiKlausa {
  /** Klausa berbentuk anjuran (bingkai "sebaiknya", "kamu harus", …). */
  bingkai: boolean;
  /** Subjeknya efek/posisi/uang — tidak termasuk kata terlarang itu sendiri. */
  pasar: boolean;
  /** Subjeknya konfigurasi alarm atau langkah pemeriksaan. */
  alarm: boolean;
  /** Penilaian atau ramalan harga ("masih menarik", "berpotensi naik"). */
  penilaian: boolean;
  /** Klausa yang justru MENOLAK meramal ("saya tidak bisa menebak saham yang akan naik"). */
  tolakRamalan: boolean;
}

/** `RegExp.test` dengan flag /g aman: lastIndex selalu dikembalikan ke 0. */
function cocok(pola: readonly RegExp[], teks: string): boolean {
  return pola.some((p) => {
    p.lastIndex = 0;
    return p.test(teks);
  });
}

/** Klasifikasi satu klausa (tanpa melihat kata terlarang). Diekspor untuk tes. */
export function nilaiKlausa(klausa: string): NilaiKlausa {
  const pasar = cocok(POLA_SUBJEK_PASAR, klausa);
  return {
    bingkai: cocok(POLA_BINGKAI, klausa),
    pasar,
    alarm: cocok(POLA_SUBJEK_ALARM, klausa),
    penilaian: cocok(POLA_PENILAIAN, klausa),
    // Menolak meramal ≠ meramal — tetapi begitu ada kata sambung pertentangan
    // ("tidak bisa meramal, TAPI SRIL akan naik") atau subjek pasar, pengecualian
    // ini batal; kalau tidak, pola "sangkal dulu lalu ramal" akan lolos.
    tolakRamalan: cocok(POLA_TOLAK_RAMALAN, klausa) && !POLA_PENGGANTI_ARAH.test(klausa) && !pasar,
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
    //    fakta di klausa itu tidak ikut hilang.
    if (kenaDiSini.size > 0) {
      const aman = n.alarm && !n.pasar && !cocok(POLA_ANJURAN, sepotong);
      return aman ? disensor : buang();
    }

    // c. Anjuran tanpa kata terlarang: dibuang HANYA bila subjeknya pasar.
    //    Usulan penyetelan alarm & langkah pemeriksaan selamat utuh.
    if (n.bingkai && n.pasar) return buang();

    // d. Subjek pasar tanpa bingkai anjuran = fakta ("orang dalam melepas
    //    sahamnya"), dan bingkai anjuran tanpa subjek pasar = usulan aturan.
    return sepotong;
  });
  kerja = hasil.join("");
  // 3. Kembalikan frasa terlindung (yang klausanya tidak dibuang).
  kerja = kerja.replace(POLA_SENTINEL, (_, i: string) => simpanan[Number(i)]);
  return { teks: kerja, kata: [...kena], kalimatDibuang: dibuang };
}

export interface HasilSensorObjek<T> {
  hasil: T;
  perluTinjau: boolean;
  kataDisensor: string[];
  /** Total kalimat/klausa yang dibuang di seluruh objek. */
  kalimatDibuang: number;
}

/**
 * Sensor semua string di dalam objek/array secara rekursif, KECUALI kunci yang
 * disebut di `lewati` (mis. `kind`, `symbol` yang berasal dari data, bukan
 * karangan model). Mengembalikan salinan baru.
 */
export function sensorObjek<T>(nilai: T, lewati: readonly string[] = []): HasilSensorObjek<T> {
  const kena = new Set<string>();
  let dibuang = 0;
  const skip = new Set(lewati);
  const jalan = (v: unknown, kunci?: string): unknown => {
    if (typeof v === "string") {
      if (kunci && skip.has(kunci)) return v;
      const s = sensorTeks(v);
      s.kata.forEach((k) => kena.add(k));
      dibuang += s.kalimatDibuang;
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
  // dengan kata terlarang: keduanya menandai keluaran model perlu ditinjau.
  return { hasil, perluTinjau: kena.size > 0 || dibuang > 0, kataDisensor: [...kena], kalimatDibuang: dibuang };
}
