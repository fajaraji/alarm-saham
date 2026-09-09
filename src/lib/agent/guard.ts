// Filter keamanan kata: mendeteksi kata rekomendasi jual-beli pada keluaran
// model. Bila muncul, kata diganti "[dihapus]" dan keluaran ditandai
// `perluTinjau` supaya UI bisa menampilkan peringatan.
//
// Tiga lapis, karena mengganti KATA-nya saja masih menyisakan bingkai anjuran
// yang utuh ("Sebaiknya [dihapus] sekarang" tetap terbaca sebagai saran):
//   1. kata terlarang → "[dihapus]";
//   2. kalimat/klausa yang SUDAH beranjuran walau tanpa kata terlarang
//      ("Sebaiknya kamu kurangi eksposur", "Rekomendasi kami: …") atau berisi
//      penilaian/prediksi harga ("masih menarik", "berpotensi naik") dibuang
//      seluruhnya — inilah lubang yang ditutup tiket 15 (keberatan 5);
//   3. kata pembingkai yang netral bila sendirian ("harus", "segera")
//      menggugurkan kalimat hanya bila kalimat itu juga memuat kata terlarang.
// Pemenggalan memakai . ! ? ; dan baris baru, sehingga klausa fakta di sebelah
// klausa anjuran ("ekuitas negatif; akumulasi disarankan") tetap selamat.
//
// Dua hal dilindungi lebih dulu agar tidak ikut terbuang:
//   - frasa faktual yang memuat kata "jual" tetapi bukan rekomendasi (nama blok
//     `insider_jual`, "filing jual", "transaksi jual" dari mesin uji);
//   - kalimat pengingkar yang justru wajib ada ("bukan saran investasi",
//     "bukan rekomendasi") — tanpa ini disclaimer wajib PLAN §2 akan tersensor
//     oleh polanya sendiri.
import { KATA_ANJURAN, KATA_TERLARANG, POLA_ANJURAN_MANDIRI, POLA_PENILAIAN } from "./instructions";

const FRASA_DILINDUNGI = [
  /insider_jual/gi,
  /\bfiling jual\b/gi,
  /\btransaksi jual\b/gi,
  /\btransaksi beli\b/gi,
  /\btipe jual\b/gi,
  /\btipe beli\b/gi,
  /\borang dalam jual\b/gi,
  // Pengingkar: menyebut kata "saran"/"rekomendasi" untuk MENOLAKNYA.
  /\bbukan (saran|rekomendasi|anjuran|nasihat)\b[^.!?;\n]*/gi,
  /\btidak (memberi|memberikan|mengandung|ada) (saran|rekomendasi|anjuran|nasihat)\b[^.!?;\n]*/gi,
  /\btanpa (saran|rekomendasi|anjuran|nasihat)\b/gi,
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
/** Pembingkai yang menggugurkan kalimat hanya bila ada kata terlarang di kalimat yang sama. */
const POLA_ANJURAN = KATA_ANJURAN.map((k) => polaKata(k));
/** Pembingkai yang menggugurkan kalimat walau tanpa kata terlarang. */
const POLA_MANDIRI = [...POLA_ANJURAN_MANDIRI.map((k) => polaKata(k)), ...POLA_PENILAIAN];
/** Pemenggal kalimat/klausa: titik, tanya, seru, titik koma, baris baru. */
const PEMENGGAL = /([.!?;\n]+)/;

export interface HasilSensor {
  teks: string;
  /** Kata terlarang yang ditemukan (huruf kecil, unik). */
  kata: string[];
  /**
   * Berapa kalimat/klausa yang dibuang seluruhnya. Bisa > 0 walau `kata` kosong
   * (anjuran tanpa kata terlarang); pemanggil WAJIB memperlakukan ini sama
   * seriusnya dengan `kata`, kalau tidak teks model yang sudah bolong akan
   * dikirim ke pengguna seolah bersih.
   */
  kalimatDibuang: number;
}

/** Sensor satu teks. */
export function sensorTeks(teks: string): HasilSensor {
  // 1. Lindungi frasa faktual dengan penanda yang tidak mengandung kata terlarang.
  const simpanan: string[] = [];
  let kerja = teks;
  for (const pola of FRASA_DILINDUNGI) {
    kerja = kerja.replace(pola, (m) => {
      simpanan.push(m);
      return `${SENTINEL}${simpanan.length - 1}${SENTINEL}`;
    });
  }
  // 2. Sensor per kalimat/klausa: kalimat beranjuran/penilaian dibuang apa pun
  //    isinya; sisanya kata terlarang diganti, lalu dibuang bila kalimat itu
  //    juga memakai pembingkai netral ("harus", "segera").
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
    // Kata terlarang dicatat lebih dulu — juga untuk kalimat yang toh akan
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
    if (cocok(POLA_MANDIRI, sepotong)) return buang();
    if (kenaDiSini.size === 0) return sepotong;
    if (!cocok(POLA_ANJURAN, sepotong)) return disensor;
    return buang();
  });
  kerja = hasil.join("");
  // 3. Kembalikan frasa terlindung (yang kalimatnya tidak dibuang).
  kerja = kerja.replace(POLA_SENTINEL, (_, i: string) => simpanan[Number(i)]);
  return { teks: kerja, kata: [...kena], kalimatDibuang: dibuang };
}

/** `RegExp.test` dengan flag /g aman: lastIndex selalu dikembalikan ke 0. */
function cocok(pola: readonly RegExp[], teks: string): boolean {
  return pola.some((p) => {
    p.lastIndex = 0;
    return p.test(teks);
  });
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
  // Kalimat yang dibuang karena beranjuran (tanpa kata terlarang) sama seriusnya
  // dengan kata terlarang: keduanya menandai keluaran model perlu ditinjau.
  return { hasil, perluTinjau: kena.size > 0 || dibuang > 0, kataDisensor: [...kena], kalimatDibuang: dibuang };
}
