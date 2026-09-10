// Satu sumber kebenaran angka penjaga aturan lomba (b): docs/penjaga-frasa.json,
// yang dihasilkan `node --import tsx scripts/ukur-penjaga.ts --snapshot` dari
// tolok ukur tests/fixtures/korpus-anjuran.json.
//
// Kenapa ada berkas ini: sebelum putaran 5, klaim tentang penyensor saran
// investasi ditulis ulang dengan kata-kata berbeda di README, docs/decisions.md,
// dan komentar kode — dan semuanya menjanjikan sesuatu yang tidak dimiliki kode
// ("kalimat yang melanggar akan dibuang seluruhnya oleh penyaring"). Dua
// pemeriksa adversarial mengukur dan membuktikan sebaliknya. Sekarang setiap
// permukaan yang menyebut angka penjaga turun dari berkas ini, dan
// tests/unit/docs/penjaga-frasa.test.ts menghitung ulang bagian `sesudah`
// langsung dari korpus + penjaga yang sungguhan lalu menolak kalau menyimpang.
import snapshot from "../../../docs/penjaga-frasa.json";
import { FRASA_BACKSTOP } from "../agent/instructions";

export const BERKAS_PENJAGA = "docs/penjaga-frasa.json";
/**
 * Contoh label frasa untuk ditampilkan di halaman metodologi. DIAMBIL dari
 * FRASA_BACKSTOP, tidak diketik ulang: selain menjaga halaman ikut berubah kalau
 * daftarnya berubah, ini juga menjauhkan istilah transaksi dari string literal
 * di berkas UI (yang diaudit tests/unit/copy/kata-terlarang.test.ts).
 */
export const CONTOH_LABEL_BACKSTOP: readonly string[] = FRASA_BACKSTOP.slice(0, 4).map((f) => f.label);
export const JUMLAH_FRASA_BACKSTOP = FRASA_BACKSTOP.length;
export const KORPUS_PENJAGA = "tests/fixtures/korpus-anjuran.json";
export const PERINTAH_UKUR_PENJAGA = "node --import tsx scripts/ukur-penjaga.ts";

export interface AngkaPenjaga {
  harusUtuhTotal: number;
  harusUtuhBerubah: number;
  presisiPersen: number;
  harusDitandaiTotal: number;
  harusDitandaiKena: number;
  recallPersen: number;
  /** Sub-korpus serang:pemburu-bocor (65 anjuran karangan; 25 dilaporkan verbatim). */
  penyerangBocorTotal: number;
  penyerangBocorTertangkap: number;
  /** Sub-korpus serang:pemburu-rakus (kalimat sah yang dulu dimakan penyensor). */
  penyerangRakusTotal: number;
  penyerangRakusTermakan: number;
}

export interface PenjagaFrasa {
  tentang: string;
  korpus: string;
  perintah: string;
  /** Tanggal pengukuran (YYYY-MM-DD). */
  tanggal: string;
  caraMengukur: string;
  /** Pengukuran pada penjaga LAMA; tidak bisa dihitung ulang dari kode sekarang. */
  sebelum: AngkaPenjaga & { commit: string; keterangan: string; caraReproduksi: string };
  sesudah: AngkaPenjaga;
  /** Frasa yang sengaja TIDAK didaftar, beserta kalimat sah yang bentrok. */
  batasYangDiakui: string[];
}

export const PENJAGA_FRASA = snapshot as PenjagaFrasa;
