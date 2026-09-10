// Satu tempat untuk setiap kalimat yang mengaku BERAPA BANYAK dan DATA APA yang
// benar-benar ada di server ini.
//
// Kenapa perlu: kalimat cakupan dulu ditulis ulang di beberapa berkas dengan
// angka 107 yang dipakukan di dalam teks (kotak cari /putar-ulang, catatan
// per-saham mode jaga, catatan emiten di luar universe). Pada jalur data contoh
// — bentuk deploy pertama, DATABASE_URL masih kosong — layar yang sama mengaku
// "data contoh (8 emiten)" tiga baris di atas "107 emiten universe uji + feed
// suspensi seluruh bursa". Itu cacat aturan lomba (d): klaim sumber tidak boleh
// menyesatkan.
//
// Aturannya: jumlah SELALU datang dari universe yang benar-benar dimuat, dan
// klaim "feed suspensi seluruh bursa" hanya boleh muncul saat sumbernya bukan
// data contoh. Tidak ada satu pun angka universe yang dipakukan di sini.

export interface Cakupan {
  /** Jumlah emiten universe yang benar-benar dimuat sumber saat ini. */
  jumlah: number;
  /** true = fixture data contoh (server tanpa DATABASE_URL dan tanpa ./.pglite). */
  contoh: boolean;
}

/** Kalimat "apa yang bisa dicari di server ini" untuk kotak cari /putar-ulang. */
export function kalimatCakupan({ jumlah, contoh }: Cakupan): string {
  return contoh
    ? `Yang tampil hanya data yang benar-benar ada di server ini: ${jumlah} emiten data contoh, bukan data Sectors nyata.`
    : `Yang tampil hanya data yang benar-benar ada di server ini: ${jumlah} emiten universe uji ditambah seluruh emiten yang pernah muncul di feed suspensi bursa.`;
}

/** Catatan per-saham saat kode yang dicek tidak punya satu baris pun di sumber. */
export function catatanTidakAdaData(symbol: string, { jumlah, contoh }: Cakupan): string {
  const isi = contoh
    ? `data contoh server ini (${jumlah} emiten, bukan data Sectors nyata)`
    : `data kami: ${jumlah} emiten universe uji ditambah emiten yang muncul di feed suspensi bursa`;
  return `${symbol} tidak ada di ${isi}; blok kelas A tidak bisa dinilai.`;
}

/**
 * Catatan emiten yang hanya muncul di data suspensi, bukan di universe uji.
 * Tidak menyebut angka: jumlah universe tidak selalu tersedia di jalur ini, dan
 * memakukan angka di kalimat justru sumber cacat yang ditutup tiket 15.
 */
export function catatanHanyaSuspensi(symbol: string, contoh: boolean): string {
  const asal = contoh
    ? "universe data contoh server ini, tetapi muncul di data suspensi contohnya"
    : "universe uji yang kami tarik, tetapi muncul di feed suspensi bursa (2018–2026)";
  return `${symbol} tidak termasuk ${asal}. Data laporan, aksi korporasi, keuangan, dan filing tidak kami tarik untuk emiten ini.`;
}
