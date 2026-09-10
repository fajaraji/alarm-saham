// Pola rahasia bersama untuk dua gerbang:
//   - scripts/check-secrets.mjs  hook pre-commit: isi yang di-stage saja (cepat).
//   - scripts/scan-history.mjs   SELURUH riwayat git, dipakai CI (npm run scan:history).
//
// Aturan lomba (c): API key tidak boleh pernah masuk repo. "Pernah" itu penting:
// repo wajib publik >= 90 hari, jadi kunci yang sempat ter-commit lalu dihapus di
// commit berikutnya TETAP terbaca dari riwayat. Karena itu pola hidup di satu
// berkas dan dipakai kedua gerbang.
//
// MENAMBAH POLA — dua aturan supaya berkas ini tidak perlu dikecualikan sendiri
// (pengecualian = titik buta permanen):
//   1. Tulis regex yang TIDAK cocok dengan teks sumbernya sendiri. Contoh:
//      /sk-ant-[A-Za-z0-9_-]{20,}/ aman karena pada baris ini setelah "sk-ant-"
//      ada karakter "[" yang tidak masuk kelas karakternya.
//   2. Untuk pola berbentuk NAMA lalu tanda sama dengan lalu nilai: awali dengan
//      (?<![\w.$]) supaya pembacaan env di kode (nama yang didahului titik,
//      seperti process.env lalu nama variabel) tidak ikut tertangkap, dan tuntut
//      nilai minimal 8 karakter supaya kalimat dokumentasi ("isi CRON_SECRET= di
//      .env.local") tidak dianggap kebocoran. Baris dotenv sungguhan tetap kena.

/** Ekstensi biner: isinya bukan teks, tidak perlu dipindai. */
export const EKSTENSI_BINER =
  /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|eot|pdf|zip|gz|tgz|mp4|webm|wasm)$/i;

/**
 * Berkas yang TIDAK pernah dipindai. Sengaja kosong: setiap pola di bawah aman
 * terhadap teks sumbernya sendiri (lihat aturan 1 di atas), jadi tidak ada
 * berkas yang perlu dibebaskan — termasuk berkas ini dan .env.example.
 */
export const DIKECUALIKAN = new Set([]);

/** Pola yang berlaku untuk SEMUA berkas teks. */
export const POLA = [
  // Bentuk kunci: yang paling penting, karena tertangkap walau tidak ditulis
  // sebagai NAMA=nilai (mis. ditempel sebagai literal di kode atau di dokumen).
  //
  // Ambang panjang 20 karakter setelah awalan, bukan 4 seperti versi lama.
  // Alasannya bukan pelonggaran: kunci Anthropic sungguhan berbentuk
  // "sk-ant-api03-" + ~95 karakter, jadi 20 masih jauh di bawah kunci terpendek
  // yang mungkin, sementara ambang 4 menandai placeholder dokumentasi sebagai
  // kebocoran. Riwayat repo ini memuat contoh seperti itu (komentar di versi
  // lama scripts/check-secrets.mjs, commit 9158433) — sudah diperiksa, isinya
  // huruf x, bukan kunci. Kunci yang dipotong pun tetap tertangkap: 20 karakter
  // masih di dalam bagian "api03-..." milik kunci asli.
  { nama: "Kunci Anthropic (awalan sk-ant-)", regex: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { nama: "Kunci gaya OpenAI/DeepSeek (awalan sk-)", regex: /\bsk-(?!ant-)[A-Za-z0-9]{20,}\b/ },
  { nama: "Kunci akses AWS (awalan AKIA)", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { nama: "Token bot Telegram", regex: /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/ },
  { nama: "URL Postgres dengan kredensial", regex: /postgres(?:ql)?:\/\/[^\s/:@]+:[^\s@]+@/ },

  // Bentuk NAMA=nilai: menangkap kunci yang ditempel di dokumen, contoh perintah
  // shell, atau .env yang tidak sengaja ter-commit.
  { nama: "SECTORS_API_KEY berisi nilai", regex: /(?<![\w.$])SECTORS_API_KEY\s*=\s*['"]?[A-Za-z0-9_\-.:/+]{8,}/ },
  { nama: "ANTHROPIC_API_KEY berisi nilai", regex: /(?<![\w.$])ANTHROPIC_API_KEY\s*=\s*['"]?[A-Za-z0-9_\-.:/+]{8,}/ },
  { nama: "DEEPSEEK_API_KEY berisi nilai", regex: /(?<![\w.$])DEEPSEEK_API_KEY\s*=\s*['"]?[A-Za-z0-9_\-.:/+]{8,}/ },
  { nama: "DATABASE_URL berisi nilai", regex: /(?<![\w.$])DATABASE_URL\s*=\s*['"]?[A-Za-z0-9_\-.:/+]{8,}/ },
  { nama: "CRON_SECRET berisi nilai", regex: /(?<![\w.$])CRON_SECRET\s*=\s*['"]?[A-Za-z0-9_\-.:/+]{8,}/ },
  { nama: "TELEGRAM_BOT_TOKEN berisi nilai", regex: /(?<![\w.$])TELEGRAM_BOT_TOKEN\s*=\s*['"]?[A-Za-z0-9_\-.:/+]{8,}/ },
  {
    nama: "TELEGRAM_WEBHOOK_SECRET berisi nilai",
    regex: /(?<![\w.$])TELEGRAM_WEBHOOK_SECRET\s*=\s*['"]?[A-Za-z0-9_\-.:/+]{8,}/,
  },
];

/**
 * Aturan tambahan khusus berkas contoh env (.env.example dan sejenisnya).
 * Berkas itu dulu dikecualikan TOTAL dengan alasan "nilainya kosong" — asumsi
 * yang sudah tidak benar (ada DEEPSEEK_MODEL=... dan SECTORS_CREDIT_RESERVE=250)
 * dan justru berkas inilah yang paling mungkin salah diisi lalu ter-commit saat
 * membantu menyiapkan lingkungan. Sekarang berkas itu dipindai: setiap baris
 * NAMA=nilai yang namanya berakhiran KEY/TOKEN/SECRET/PASSWORD/URL ditolak,
 * kecuali nama yang terdaftar sebagai nilai contoh non-rahasia di bawah.
 */
export const POLA_BERKAS_ENV = /(^|\/)\.env(\.|$)/;
const NAMA_ENV_RAHASIA = /^([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|URL))\s*=\s*(\S)/;
/** Nama yang boleh membawa nilai di berkas contoh (bukan rahasia). */
export const NILAI_CONTOH_DIIZINKAN = new Set([
  "APP_URL", // hanya alamat aplikasi setelah deploy, bukan rahasia
]);

/** Apakah berkas ini dilewati (biner atau dikecualikan)? */
export function berkasDilewati(jalur) {
  const normal = jalur.replace(/\\/g, "/");
  return DIKECUALIKAN.has(normal) || EKSTENSI_BINER.test(normal);
}

/**
 * Periksa isi satu berkas. Mengembalikan daftar temuan berisi NOMOR BARIS dan
 * NAMA POLA saja — isi baris tidak pernah ikut, supaya nilai rahasia tidak
 * berpindah ke log CI yang justru publik.
 */
export function periksaIsi(jalur, isi) {
  const normal = jalur.replace(/\\/g, "/");
  if (berkasDilewati(normal)) return [];
  const berkasEnv = POLA_BERKAS_ENV.test(normal);
  const temuan = [];

  isi.split(/\r?\n/).forEach((teks, i) => {
    for (const p of POLA) {
      if (p.regex.test(teks)) temuan.push({ jalur: normal, baris: i + 1, pola: p.nama });
    }
    if (berkasEnv) {
      const cocok = NAMA_ENV_RAHASIA.exec(teks);
      if (cocok && !NILAI_CONTOH_DIIZINKAN.has(cocok[1])) {
        temuan.push({
          jalur: normal,
          baris: i + 1,
          pola: `Berkas contoh env: ${cocok[1]} sudah berisi nilai`,
        });
      }
    }
  });

  return temuan;
}
