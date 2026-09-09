// Aritmetika tanggal kalender untuk mesin uji-ke-masa-lalu.
//
// Semua tanggal berupa string "YYYY-MM-DD" dan dihitung dalam UTC agar hasil
// identik di mesin mana pun (zona waktu lokal tidak berpengaruh). Perbandingan
// urutan tanggal cukup memakai perbandingan string karena formatnya tetap.

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

export function pastikanTanggal(nama: string, nilai: string): string {
  if (!POLA_TANGGAL.test(nilai) || Number.isNaN(Date.parse(`${nilai}T00:00:00Z`))) {
    throw new Error(`${nama} harus berformat YYYY-MM-DD, diterima "${nilai}"`);
  }
  return nilai;
}

function urai(d: string): { y: number; m: number; hari: number } {
  return { y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)), hari: Number(d.slice(8, 10)) };
}

function susun(y: number, m: number, hari: number): string {
  return new Date(Date.UTC(y, m - 1, hari)).toISOString().slice(0, 10);
}

/** Hari terakhir bulan (y, m) dengan m = 1..12. */
function hariTerakhir(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Akhir bulan dari tanggal yang diberikan. */
export function akhirBulan(d: string): string {
  const { y, m } = urai(d);
  return susun(y, m, hariTerakhir(y, m));
}

export function tambahHari(d: string, n: number): string {
  const { y, m, hari } = urai(d);
  return susun(y, m, hari + n);
}

/** Tambah n bulan; hari dijepit ke hari terakhir bulan tujuan (31 Jan + 1 → 28/29 Feb). */
export function tambahBulan(d: string, n: number): string {
  const { y, m, hari } = urai(d);
  const total = y * 12 + (m - 1) + n;
  const y2 = Math.floor(total / 12);
  const m2 = (total % 12) + 1;
  return susun(y2, m2, Math.min(hari, hariTerakhir(y2, m2)));
}

export function tambahTahun(d: string, n: number): string {
  return tambahBulan(d, n * 12);
}

/**
 * Selisih bulan utuh dari `dari` ke `sampai` (negatif bila terbalik).
 * 2021-05-31 → 2024-11-01 = 41 (42 bulan kalender, dikurangi 1 karena tanggal
 * tujuan lebih kecil dari tanggal asal).
 */
export function selisihBulan(dari: string, sampai: string): number {
  const a = urai(dari);
  const b = urai(sampai);
  let bulan = (b.y - a.y) * 12 + (b.m - a.m);
  if (bulan > 0 && b.hari < a.hari) bulan -= 1;
  if (bulan < 0 && b.hari > a.hari) bulan += 1;
  return bulan;
}

/** Semua akhir bulan dalam rentang [dari, sampai], urut naik. */
export function daftarAkhirBulan(dari: string, sampai: string): string[] {
  const hasil: string[] = [];
  let t = akhirBulan(dari);
  while (t <= sampai) {
    if (t >= dari) hasil.push(t);
    t = akhirBulan(tambahBulan(t, 1));
  }
  return hasil;
}

/** Akhir kuartal kalender (31 Mar, 30 Jun, 30 Sep, 31 Des) dalam [dari, sampai]. */
export function daftarAkhirKuartal(dari: string, sampai: string): string[] {
  return daftarAkhirBulan(dari, sampai).filter((t) => Number(t.slice(5, 7)) % 3 === 0);
}

/** Label kuartal Sectors ("q1".."q4") dan tahun fiskal dari tanggal akhir periode. */
export function labelKuartal(akhirPeriode: string): { fiscalYear: number; quarter: string } {
  const { y, m } = urai(akhirPeriode);
  return { fiscalYear: y, quarter: `q${Math.ceil(m / 3)}` };
}

/**
 * Tanggal hari ini (UTC) sebagai YYYY-MM-DD.
 *
 * `ALARM_HARI_INI=YYYY-MM-DD` memakukan nilainya. Dipakai HANYA untuk tes/e2e
 * (playwright.config.ts) supaya hasil layar tidak berubah seiring hari berjalan
 * — mis. blok `laporan_hilang` yang mulai berbunyi 120 hari setelah akhir
 * kuartal. Jangan diset di produksi.
 */
export function hariIni(): string {
  const paksa = typeof process !== "undefined" ? process.env?.ALARM_HARI_INI?.trim() : undefined;
  if (paksa && POLA_TANGGAL.test(paksa)) return paksa;
  return new Date().toISOString().slice(0, 10);
}

export function maksTanggal(a: string, b: string): string {
  return a >= b ? a : b;
}
