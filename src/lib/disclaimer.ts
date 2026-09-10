// Satu tempat untuk kalimat disclaimer wajib (PLAN.md §2). Sebelumnya ada DUA
// konstanta bernama `DISCLAIMER` dengan bunyi berbeda di dua modul terpisah
// (src/components/panduan/kamus.ts dan src/lib/agent/instructions.ts), sehingga
// kalimat wajib produk bisa berubah di satu tempat tanpa yang lain ikut.
//
// Keduanya sengaja TETAP dua kalimat, bukan satu:
//   - DISCLAIMER_PESAN adalah bunyi persis yang dikunci PLAN.md §2 untuk setiap
//     pesan keluar (Telegram, kotak masuk, keluaran agent). Jangan diubah.
//   - DISCLAIMER_UI adalah kalimat footer layar; ia menyebut "dan analisis"
//     karena layar memang menampilkan hasil analisis (skor uji, diagnosis).
// Yang wajib: keduanya memuat klausa inti "bukan saran investasi"
// (dikunci tests/unit/copy/disclaimer.test.ts).

/** Klausa inti yang wajib ada di setiap kalimat disclaimer. */
export const KLAUSA_INTI = "bukan saran investasi";

/** Kalimat wajib di setiap pesan keluar (PLAN.md §2) — bunyi persis. */
export const DISCLAIMER_PESAN = "Alarm Saham adalah alat informasi, bukan saran investasi.";

/** Kalimat disclaimer footer setiap layar. */
export const DISCLAIMER_UI = "Alarm Saham adalah alat informasi dan analisis, bukan saran investasi.";
