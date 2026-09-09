// Filter keamanan kata: mendeteksi kata rekomendasi jual-beli pada keluaran
// model. Bila muncul, kata diganti "[dihapus]" dan keluaran ditandai
// `perluTinjau` supaya UI bisa menampilkan peringatan.
//
// Dua lapis, karena mengganti KATA-nya saja masih menyisakan bingkai anjuran
// yang utuh ("Sebaiknya [dihapus] sekarang" tetap terbaca sebagai saran):
//   1. kata terlarang → "[dihapus]";
//   2. bila kalimat/klausa yang sama juga memuat kata pembingkai anjuran
//      ("sebaiknya", "disarankan", …), SELURUH kalimat itu dibuang.
// Pemenggalan memakai . ! ? ; dan baris baru, sehingga klausa fakta di sebelah
// klausa anjuran ("ekuitas negatif; akumulasi disarankan") tetap selamat.
//
// Frasa faktual yang memuat kata "jual" tetapi bukan rekomendasi (nama blok
// `insider_jual`, "filing jual", "transaksi jual" dari mesin uji) dilindungi
// agar tidak tersensor.
import { KATA_ANJURAN, KATA_TERLARANG } from "./instructions";

const FRASA_DILINDUNGI = [
  /insider_jual/gi,
  /\bfiling jual\b/gi,
  /\btransaksi jual\b/gi,
  /\btransaksi beli\b/gi,
  /\btipe jual\b/gi,
  /\btipe beli\b/gi,
  /\borang dalam jual\b/gi,
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
const POLA_ANJURAN = KATA_ANJURAN.map((k) => polaKata(k));
/** Pemenggal kalimat/klausa: titik, tanya, seru, titik koma, baris baru. */
const PEMENGGAL = /([.!?;\n]+)/;

export interface HasilSensor {
  teks: string;
  /** Kata terlarang yang ditemukan (huruf kecil, unik). */
  kata: string[];
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
  // 2. Sensor per kalimat/klausa: kata terlarang diganti; bila kalimat itu juga
  //    berbingkai anjuran, seluruh kalimatnya dibuang.
  const kena = new Set<string>();
  const bagian = kerja.split(PEMENGGAL);
  const hasil = bagian.map((sepotong, i) => {
    if (i % 2 === 1) return sepotong; // pemenggal (tanda baca) — biarkan
    const kenaDiSini = new Set<string>();
    let disensor = sepotong;
    for (const { kata, pola } of POLA_TERLARANG) {
      disensor = disensor.replace(pola, () => {
        kenaDiSini.add(kata);
        return PENGGANTI;
      });
    }
    kenaDiSini.forEach((k) => kena.add(k));
    if (kenaDiSini.size === 0) return sepotong;
    const beranjuran = POLA_ANJURAN.some((p) => {
      p.lastIndex = 0;
      return p.test(sepotong);
    });
    if (!beranjuran) return disensor;
    // Pertahankan spasi pembuka/penutup agar tanda baca tidak menempel aneh.
    const depan = /^\s*/.exec(sepotong)![0];
    const belakang = /\s*$/.exec(sepotong)![0];
    return `${depan}${PENGGANTI_KALIMAT}${belakang}`;
  });
  kerja = hasil.join("");
  // 3. Kembalikan frasa terlindung (yang kalimatnya tidak dibuang).
  kerja = kerja.replace(POLA_SENTINEL, (_, i: string) => simpanan[Number(i)]);
  return { teks: kerja, kata: [...kena] };
}

export interface HasilSensorObjek<T> {
  hasil: T;
  perluTinjau: boolean;
  kataDisensor: string[];
}

/**
 * Sensor semua string di dalam objek/array secara rekursif, KECUALI kunci yang
 * disebut di `lewati` (mis. `kind`, `symbol` yang berasal dari data, bukan
 * karangan model). Mengembalikan salinan baru.
 */
export function sensorObjek<T>(nilai: T, lewati: readonly string[] = []): HasilSensorObjek<T> {
  const kena = new Set<string>();
  const skip = new Set(lewati);
  const jalan = (v: unknown, kunci?: string): unknown => {
    if (typeof v === "string") {
      if (kunci && skip.has(kunci)) return v;
      const s = sensorTeks(v);
      s.kata.forEach((k) => kena.add(k));
      return s.teks;
    }
    if (Array.isArray(v)) return v.map((x) => jalan(x, kunci));
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, jalan(x, k)]));
    }
    return v;
  };
  return { hasil: jalan(nilai) as T, perluTinjau: kena.size > 0, kataDisensor: [...kena] };
}
