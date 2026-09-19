// Kalimat biasa untuk hasil "data terkini" (kelas B) per saham (tiket 26).
//
// Dulu layar Pasang menampilkan `ritel_dominan: tidak (broker ritel 45% dari
// nilai pembelian ...)`: nama mesin blok, lalu teks teknis dengan ambang dan
// jumlah baris registry. Di sini setiap temuan menjadi SATU kalimat yang
// menyebut angkanya (DESIGN.md aturan 5), dan saham yang dilewati menyebut
// alasannya. Murni: tanpa I/O, dipakai layar Pasang dan template pesan
// penjelasan (kotak masuk, Telegram).
import { fmtTanggal } from "../putar-ulang/ringkas";
import { AMBANG_B, type BlokBKind, type HasilBlokB } from "./blok-b";
import type { KelasBSaham } from "./evaluasi";

/** Judul singkat setiap temuan, dalam bahasa pengguna. */
export const JUDUL_TEMUAN_B: Record<BlokBKind, string> = {
  ritel_dominan: "Siapa yang membeli, 14 hari terakhir",
  jatuh_dari_puncak: "Harga dibanding puncak 90 hari",
  free_float_kecil: "Saham yang beredar di publik",
};

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
  if (d.startsWith("dilewati: cadangan kredit")) return "Tidak dicek: kredit Sectors tim tinggal cadangan.";
  if (d.startsWith("tidak ada data di Sectors")) return "Sectors tidak punya data ini untuk saham ini.";
  if (d.startsWith("gagal: Sectors HTTP")) return "Data ini gagal diambil dari Sectors. Coba cek lagi nanti.";
  if (d.startsWith("gagal:")) return "Data ini gagal diambil karena kesalahan di server kami. Coba cek lagi nanti.";
  if (d.startsWith("tidak ada transaksi broker")) return "Tidak ada transaksi broker dalam 14 hari terakhir.";
  if (d.startsWith("cohort broker tidak dikenal")) return "Porsi pembeli ritel tidak bisa dihitung: brokernya tidak ada di daftar Sectors.";
  if (d.startsWith("nilai pembelian nol")) return "Tidak ada nilai pembelian dalam 14 hari terakhir.";
  if (d.startsWith("tidak ada harga penutupan")) return "Tidak ada harga penutupan dalam 90 hari terakhir.";
  if (d.startsWith("simbol tidak ada di snapshot")) return "Saham ini tidak ada di data saham beredar Sectors.";
  return d.charAt(0).toUpperCase() + d.slice(1) + (/[.!?]$/.test(d) ? "" : ".");
}

/**
 * Satu temuan data terkini sebagai satu kalimat berikut angkanya. Apakah
 * temuannya memenuhi syarat alarm dikatakan lencana di layar, dan ambangnya
 * dijelaskan tooltip kamus, jadi kalimatnya tidak mengulang keduanya.
 */
export function kalimatBlokB(b: HasilBlokB): string {
  const u = b.ukuran;
  if (u?.jenis === "ritel") {
    const net = u.netAsingInstitusi;
    const arah =
      net < 0 ? `melepas bersih ${rupiahAwam(net)}` : net > 0 ? `menambah bersih ${rupiahAwam(net)}` : "tidak menambah maupun melepas";
    return `Dalam ${u.hariBursa} hari bursa (${fmtTanggal(u.mulai)} sampai ${fmtTanggal(u.akhir)}), ${persen(u.porsiRitel)} nilai pembelian datang dari broker ritel, sementara broker asing dan institusi ${arah}.`;
  }
  if (u?.jenis === "puncak") {
    const akhir = `${hargaRp(u.closeAkhir)} pada ${fmtTanggal(u.tanggalAkhir)}`;
    if (u.turun <= 0) return `Harga penutupan terakhir (${akhir}) adalah yang tertinggi dalam 90 hari.`;
    return `Harga penutupan terakhir (${akhir}) ${persen(u.turun)} di bawah harga tertinggi 90 hari (${hargaRp(u.puncak)} pada ${fmtTanggal(u.tanggalPuncak)}).`;
  }
  if (u?.jenis === "free_float") {
    const porsi = `${angka(u.freeFloat * 100)}%`;
    return b.terpenuhi
      ? `Hanya ${porsi} saham yang beredar di publik, di bawah batas ${persen(AMBANG_B.freeFloat)}.`
      : `${porsi} saham beredar di publik.`;
  }
  return kalimatTanpaAngka(b);
}

/**
 * Data terkini dilewati karena SERVER-nya (tanpa kunci Sectors atau database
 * pencatat kredit), bukan karena sahamnya. Alasan itu sama untuk setiap saham,
 * jadi layar menyebutnya sekali, bukan per saham (DESIGN.md aturan 1).
 */
export function dilewatiKarenaServer(kelasB: KelasBSaham): boolean {
  return kelasB.status === "dilewati" && kelasB.keterangan.startsWith("dilewati: server");
}

/**
 * Alasan data terkini tidak ditarik untuk satu saham, dalam satu kalimat.
 * String kosong bila alasannya berlaku untuk seluruh server.
 */
export function kalimatDilewati(kelasB: KelasBSaham): string {
  if (dilewatiKarenaServer(kelasB)) return "";
  const mentah = kelasB.keterangan.replace(/^dilewati:\s*/, "").replace(/[.!?]$/, "");
  const alasan = mentah.startsWith("cadangan kredit") ? "kredit Sectors tim tinggal cadangan" : mentah;
  return `Data terkini tidak ditarik karena ${alasan}.`;
}
