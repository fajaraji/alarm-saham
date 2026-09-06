// Filter keamanan kata: mendeteksi kata rekomendasi jual-beli pada keluaran
// model. Bila muncul, kata diganti "[dihapus]" dan keluaran ditandai
// `perluTinjau` supaya UI bisa menampilkan peringatan.
//
// Frasa faktual yang memuat kata "jual" tetapi bukan rekomendasi (nama blok
// `insider_jual`, "filing jual", "transaksi jual" dari mesin uji) dilindungi
// agar tidak tersensor.
import { KATA_TERLARANG } from "./instructions";

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
  // 2. Sensor kata terlarang.
  const kena = new Set<string>();
  for (const { kata, pola } of POLA_TERLARANG) {
    kerja = kerja.replace(pola, () => {
      kena.add(kata);
      return PENGGANTI;
    });
  }
  // 3. Kembalikan frasa terlindung.
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
