// BACKSTOP frasa untuk keluaran model — lapis KETIGA, bukan penjaga utama.
//
// Apa yang berkas ini KERJAKAN
//   Mencari frasa dari FRASA_BACKSTOP (src/lib/agent/instructions.ts) di teks
//   yang ditulis model, meredaksi HANYA frasa yang cocok, dan melaporkan
//   temuannya supaya pemanggil bisa menandai keluaran itu perlu ditinjau.
//
// Apa yang berkas ini TIDAK kerjakan — dan kenapa
//   Ia tidak lagi mencoba MENGKLASIFIKASI kalimat. Empat putaran mencoba
//   memutuskan "apakah subjek klausa ini posisi pengguna atau konfigurasi
//   alarm?" dengan regex, dan dua penyerang independen membuktikan
//   pendekatannya salah pada commit 72a33ca: 60 dari 65 anjuran investasi baru
//   lolos utuh dengan perluTinjau=false (setiap imbuhan di-/-kan, salah ketik
//   "jual2"/"cutlos", tanda hubung "cut-loss", dan slang bursa "lego"/"hajar
//   kanan" melewati daftar kata tertutup) SEKALIGUS 41 dari 83 kalimat sah
//   dimakan — termasuk KEDUA `usulanBlok[].alasan` pada satu objek diagnosis
//   realistis, sehingga panel menampilkan usulan blok tanpa alasan. Yang
//   dimakan justru keluaran inti produk: pembenaran berangka yang diminta
//   INSTRUKSI_DIAGNOSIS ("jumlah temuan akan naik dari 26 menjadi 41"),
//   kosakata diagnosis wajar ("blok insider_jual tidak cocok dipakai untuk
//   kejadian sebelum 2024"), pesan blok free_float_kecil ("porsi saham yang
//   dipegang masyarakat hanya 3,2%"), dan fakta aksi korporasi.
//
// Perilakunya sekarang
//   * REDAKSI FRASA, bukan pemenggalan kalimat. Tidak ada lagi pengganti
//     "[kalimat saran dihapus]" untuk seluruh kalimat: satu frasa yang cocok
//     diganti "[dihapus]" dan sisa kalimatnya utuh. Konsekuensinya kalimat
//     fakta di sekitarnya tidak pernah hilang lagi.
//   * TANDAI, jangan gunting, pada medan yang tidak boleh bolong. `sensorObjek`
//     menerima `tandaiSaja` untuk kunci seperti `usulanBlok[].alasan`: teks
//     aslinya dibiarkan apa adanya, temuannya hanya dicatat, dan UI memasang
//     tanda peringatan. Lebih baik pengguna melihat kalimat bermasalah yang
//     ditandai daripada usulan blok tanpa alasan.
//   * PRESISI di atas RECALL. Daftar frasanya sengaja pendek dan hanya memuat
//     frasa yang tidak mungkin bermakna lain. Recall diukur dan dilaporkan apa
//     adanya (tests/unit/agent/guard-korpus.test.ts mencetak angkanya); ia
//     rendah dan TIDAK menjamin semua anjuran tertangkap. Yang menjaga aturan
//     lomba (b) adalah instruksi sistem (INSTRUKSI_DASAR butir 1/1b/1c) +
//     keluaran terstruktur + disclaimer; berkas ini hanya jaring terakhir.
import { FRASA_BACKSTOP } from "./instructions";

/** Pengganti satu frasa yang cocok. */
export const PENGGANTI = "[dihapus]";

/** Tanda pisah yang dinormalkan menjadi spasi agar "cut-loss" ikut tertangkap. */
const TANDA_PISAH = new Set(["-", "‐", "‑", "‒", "–", "—", "−", " ", " ", " "]);

/**
 * Normalisasi yang MEMPERTAHANKAN PANJANG string: huruf kecil, tanda hubung /
 * pisah / spasi tak-putus → spasi biasa. Indeks di hasil normalisasi karena itu
 * masih menunjuk ke posisi yang sama di teks asli, sehingga redaksi bisa
 * mengganti frasa aslinya (bukan versi normalnya). Karakter yang huruf kecilnya
 * lebih dari satu satuan (mis. "İ") dibiarkan apa adanya supaya panjangnya
 * tidak bergeser.
 */
export function normalisasi(teks: string): string {
  let keluar = "";
  for (let i = 0; i < teks.length; i += 1) {
    const c = teks[i];
    if (TANDA_PISAH.has(c)) {
      keluar += " ";
      continue;
    }
    const kecil = c.toLowerCase();
    keluar += kecil.length === 1 ? kecil : c;
  }
  return keluar;
}

/** Satu frasa yang ditemukan di teks. */
export interface TemuanFrasa {
  label: string;
  /** Indeks awal & akhir pada teks ASLI. */
  mulai: number;
  selesai: number;
}

/**
 * Cari semua frasa backstop. Rentang yang bertumpang-tindih digabung supaya
 * redaksinya tidak saling menimpa; setiap label tetap dilaporkan.
 */
export function cariFrasa(teks: string): TemuanFrasa[] {
  const t = normalisasi(teks);
  const mentah: TemuanFrasa[] = [];
  for (const f of FRASA_BACKSTOP) {
    const pola = new RegExp(f.pola, "g");
    let m: RegExpExecArray | null;
    while ((m = pola.exec(t)) !== null) {
      if (m[0].length === 0) {
        pola.lastIndex += 1;
        continue;
      }
      mentah.push({ label: f.label, mulai: m.index, selesai: m.index + m[0].length });
    }
  }
  return mentah.sort((a, b) => a.mulai - b.mulai || a.selesai - b.selesai);
}

/** Label unik dari sekumpulan temuan, urut sesuai kemunculan pertama. */
function label(temuan: readonly TemuanFrasa[]): string[] {
  const keluar: string[] = [];
  for (const x of temuan) if (!keluar.includes(x.label)) keluar.push(x.label);
  return keluar;
}

/**
 * PERIKSA saja: laporkan frasa yang ditemukan tanpa mengubah satu karakter pun.
 * Dipakai untuk medan yang tidak boleh bolong (`usulanBlok[].alasan`).
 */
export function periksaFrasa(teks: string): string[] {
  return label(cariFrasa(teks));
}

export interface HasilSensor {
  /** Teks dengan HANYA frasa yang cocok diganti `[dihapus]`. */
  teks: string;
  /** Label frasa yang diredaksi (unik, urut kemunculan). */
  kata: string[];
  /** true bila ada satu pun frasa yang ditemukan. */
  perluTinjau: boolean;
}

/** Redaksi frasa backstop pada satu teks. Kalimat lain tidak pernah tersentuh. */
export function sensorTeks(teks: string): HasilSensor {
  const temuan = cariFrasa(teks);
  if (temuan.length === 0) return { teks, kata: [], perluTinjau: false };
  // Gabungkan rentang yang bertumpang-tindih atau bersentuhan.
  const gabung: { mulai: number; selesai: number }[] = [];
  for (const x of temuan) {
    const akhir = gabung[gabung.length - 1];
    if (akhir && x.mulai <= akhir.selesai) akhir.selesai = Math.max(akhir.selesai, x.selesai);
    else gabung.push({ mulai: x.mulai, selesai: x.selesai });
  }
  let hasil = "";
  let posisi = 0;
  for (const g of gabung) {
    hasil += teks.slice(posisi, g.mulai) + PENGGANTI;
    posisi = g.selesai;
  }
  hasil += teks.slice(posisi);
  return { teks: hasil, kata: label(temuan), perluTinjau: true };
}

export interface OpsiSensorObjek {
  /**
   * Kunci yang isinya DATA, bukan karangan model (`kind`, `threshold`,
   * `symbol`, `buktiTanggal`): dikembalikan apa adanya, tidak diperiksa.
   */
  lewati?: readonly string[];
  /**
   * Kunci prosa yang TIDAK BOLEH digunting. Teksnya dikembalikan utuh; frasa
   * yang ditemukan hanya dicatat di `kataDisensor` dan menyalakan
   * `perluTinjau`. Dipakai untuk `usulanBlok[].alasan`: usulan blok tanpa
   * alasan lebih merugikan pengguna daripada alasan bermasalah yang ditandai.
   */
  tandaiSaja?: readonly string[];
}

export interface HasilSensorObjek<T> {
  hasil: T;
  /** true bila ada frasa yang diredaksi ATAU ditandai di mana pun dalam objek. */
  perluTinjau: boolean;
  /** Label frasa yang ditemukan di seluruh objek (unik). */
  kataDisensor: string[];
}

function bacaOpsi(o: readonly string[] | OpsiSensorObjek): Required<OpsiSensorObjek> {
  if (Array.isArray(o)) return { lewati: o, tandaiSaja: [] };
  const x = o as OpsiSensorObjek;
  return { lewati: x.lewati ?? [], tandaiSaja: x.tandaiSaja ?? [] };
}

/**
 * Periksa semua string di dalam objek/array secara rekursif. Mengembalikan
 * salinan baru; `lewati` dikembalikan apa adanya dan `tandaiSaja` dibiarkan
 * utuh tetapi temuannya dilaporkan.
 */
export function sensorObjek<T>(
  nilai: T,
  opsi: readonly string[] | OpsiSensorObjek = {},
): HasilSensorObjek<T> {
  const { lewati, tandaiSaja } = bacaOpsi(opsi);
  const skip = new Set(lewati);
  const tandai = new Set(tandaiSaja);
  const kena: string[] = [];
  const catat = (labels: readonly string[]) => {
    for (const l of labels) if (!kena.includes(l)) kena.push(l);
  };
  const jalan = (v: unknown, kunci?: string): unknown => {
    if (typeof v === "string") {
      if (kunci && skip.has(kunci)) return v;
      if (kunci && tandai.has(kunci)) {
        catat(periksaFrasa(v));
        return v;
      }
      const s = sensorTeks(v);
      catat(s.kata);
      return s.teks;
    }
    if (Array.isArray(v)) return v.map((x) => jalan(x, kunci));
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, jalan(x, k)]));
    }
    return v;
  };
  const hasil = jalan(nilai) as T;
  return { hasil, perluTinjau: kena.length > 0, kataDisensor: kena };
}
