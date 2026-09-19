// Kalimat biasa untuk hasil "data terkini" (kelas B) per saham (tiket 26).
//
// Dulu layar Pasang menampilkan `ritel_dominan: tidak (broker ritel 45% dari
// nilai pembelian ...)`: nama mesin blok, lalu teks teknis dengan ambang dan
// jumlah baris registry. Di sini setiap temuan menjadi satu kalimat yang
// menyebut angkanya, dan saham yang dilewati menyebut alasannya. Murni: tanpa
// I/O, dipakai layar Pasang dan template pesan penjelasan (kotak masuk,
// Telegram).
import { AMBANG_B, type BlokBKind, type HasilBlokB } from "./blok-b";
import type { KelasBSaham } from "./evaluasi";

/** Judul singkat setiap temuan, dalam bahasa pengguna. */
export const JUDUL_TEMUAN_B: Record<BlokBKind, string> = {
  ritel_dominan: "Siapa yang membeli, 14 hari terakhir",
  jatuh_dari_puncak: "Harga dibanding puncak 90 hari",
  free_float_kecil: "Saham yang beredar di publik",
};

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function tanggal(t: string): string {
  const [y, m, d] = t.split("-").map(Number);
  if (!y || !m || !d) return t;
  return `${d} ${BULAN[m - 1]} ${y}`;
}

function persen(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function angka(x: number, digit = 1): string {
  return x.toLocaleString("id-ID", { maximumFractionDigits: digit });
}

/** Rupiah dalam satuan yang dibaca orang: juta, miliar, triliun. */
export function rupiahAwam(x: number): string {
  const abs = Math.abs(x);
  if (abs >= 1e12) return `Rp${angka(abs / 1e12, 2)} triliun`;
  if (abs >= 1e9) return `Rp${angka(abs / 1e9)} miliar`;
  if (abs >= 1e6) return `Rp${angka(abs / 1e6)} juta`;
  return `Rp${angka(Math.round(abs), 0)}`;
}

function hargaRp(x: number): string {
  return `Rp${angka(x, 0)}`;
}

/**
 * Kalimat untuk temuan yang TIDAK punya angka: datanya kosong, atau
 * pengambilannya gagal/dilewati. Teks sumbernya dibuat di blok-b.ts dan
 * evaluasi.ts (repo yang sama), dan tes mengunci pasangan keduanya.
 */
function kalimatTanpaAngka(b: HasilBlokB): string {
  const d = b.detail;
  if (d.startsWith("dilewati: cadangan kredit")) return "Tidak dicek: kredit Sectors tim tinggal cadangan, jadi data ini tidak ditarik.";
  if (d.startsWith("tidak ada data di Sectors")) return "Sectors tidak punya data ini untuk saham ini.";
  if (d.startsWith("gagal: Sectors HTTP")) return "Data ini gagal diambil dari Sectors. Coba cek lagi nanti.";
  if (d.startsWith("gagal:")) return "Data ini gagal diambil karena kesalahan di server kami. Coba cek lagi nanti.";
  if (d.startsWith("tidak ada transaksi broker")) return "Tidak ada transaksi broker dalam 14 hari terakhir; kemungkinan saham ini tidak diperdagangkan.";
  if (d.startsWith("cohort broker tidak dikenal")) return "Broker yang bertransaksi tidak ada di daftar broker Sectors, jadi porsi pembeli ritel tidak bisa dihitung.";
  if (d.startsWith("nilai pembelian nol")) return "Tidak ada nilai pembelian dalam 14 hari terakhir.";
  if (d.startsWith("tidak ada harga penutupan")) return "Tidak ada harga penutupan dalam 90 hari terakhir.";
  if (d.startsWith("simbol tidak ada di snapshot")) return "Saham ini tidak ada di data saham beredar Sectors.";
  return d.charAt(0).toUpperCase() + d.slice(1) + (/[.!?]$/.test(d) ? "" : ".");
}

/** Satu temuan data terkini sebagai kalimat biasa, berikut angkanya. */
export function kalimatBlokB(b: HasilBlokB): string {
  const u = b.ukuran;
  if (u?.jenis === "ritel") {
    const net = u.netAsingInstitusi;
    const arah =
      net < 0 ? `melepas bersih ${rupiahAwam(net)}` : net > 0 ? `menambah bersih ${rupiahAwam(net)}` : "tidak menambah maupun melepas";
    const dasar = `Dalam ${u.hariBursa} hari bursa (${tanggal(u.mulai)} sampai ${tanggal(u.akhir)}), ${persen(u.porsiRitel)} nilai pembelian datang dari broker ritel, sementara broker asing dan institusi ${arah}.`;
    return b.terpenuhi
      ? `${dasar} Pembelinya didominasi ritel sementara institusi melepas.`
      : `${dasar} Ini belum pola ritel dominan, yang butuh ritel minimal ${persen(AMBANG_B.ritelPorsi)} dan institusi melepas.`;
  }
  if (u?.jenis === "puncak") {
    const akhir = `${hargaRp(u.closeAkhir)} pada ${tanggal(u.tanggalAkhir)}`;
    if (u.turun <= 0) return `Harga penutupan terakhir (${akhir}) adalah yang tertinggi dalam 90 hari.`;
    const dasar = `Harga penutupan terakhir (${akhir}) ${persen(u.turun)} di bawah harga tertinggi 90 hari (${hargaRp(u.puncak)} pada ${tanggal(u.tanggalPuncak)}).`;
    return b.terpenuhi ? `${dasar} Turunnya sudah melewati batas ${persen(1 - AMBANG_B.jatuhRasio)}.` : dasar;
  }
  if (u?.jenis === "free_float") {
    const porsi = `${angka(u.freeFloat * 100)}%`;
    return b.terpenuhi
      ? `Hanya ${porsi} saham yang beredar di publik, di bawah batas ${persen(AMBANG_B.freeFloat)}.`
      : `${porsi} saham beredar di publik.`;
  }
  return kalimatTanpaAngka(b);
}

/** Alasan data terkini tidak ditarik untuk satu saham, sebagai kalimat. */
export function kalimatDilewati(kelasB: KelasBSaham): string {
  const mentah = kelasB.keterangan.replace(/^dilewati:\s*/, "");
  const alasan = mentah.startsWith("cadangan kredit") ? "kredit Sectors tim tinggal cadangan" : mentah;
  return `Data terkini tidak ditarik untuk saham ini: ${alasan}${/[.!?]$/.test(alasan) ? "" : "."}`;
}
