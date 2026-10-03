// Teks awam layar "Rakit alarm" (satu tempat agar tes & komponen sepakat).
// Catatan audit-003: field `eyebrow` ("Langkah 2 dari 3") DIHAPUS 2026-10-02.
// Posisi halaman sudah dibawa chip bernomor di header dan rantai Sebelumnya /
// Berikutnya di bawah; kemunculan ketiganya melanggar DESIGN.md butir 1.
export const TEKS = {
  judul: "Rakit alarm: seret blok, lalu uji ke masa lalu.",
  paletJudul: "Kotak blok",
  paletSub: "Seret ke papan. (Klik juga bisa.)",
  papanJudul: "Papan alarm",
  papanSub: "Alarm = KALAU … syarat … MAKA bunyikan.",
  papanKosongJudul: "Seret blok syarat ke sini",
  papanKosongSub: "atau klik blok di kotak kiri, atau minta AI merakit di atas",
  kalau: "KALAU",
  kalauTeks: "saham yang dipantau …",
  maka: "MAKA",
  makaTeks: "bunyikan alarm dan kirim penjelasannya",
  buang: "Seret blok ke sini untuk membuang",
  tombolUji: "Uji ke masa lalu",
  tombolKosongkan: "Kosongkan",
  tombolSimpan: "Simpan alarm ini",
  tombolLihatTautan: "Lihat tautan rahasia",
  tombolAi: "Minta AI rakit",
  placeholderAi: "mis. alarm untuk saham yang berisiko gagal bayar",
  hasilJudul: "Hasil uji",
  aiJudul: "Penjelasan AI",
  aiBelum: "Rakit alarm dulu, lalu klik “Uji ke masa lalu”.",
  aiMemeriksa: "AI sedang mencari celah pada alarm yang dirakit…",
  aiMerakit: "AI sedang merakit blok…",
  papanKosongUji: "Papan alarm masih kosong. Klik atau seret satu blok dari kotak kiri, atau minta AI merakit.",
  sumberDb: "data Sectors nyata",
  sumberFixture: "data contoh (bukan data Sectors nyata)",
} as const;

// Catatan legenda menyebut LABEL kotak (yang juga ada di title/aria-label tiap
// sel), bukan nama warna; tujuannya supaya berguna untuk pengguna buta warna dan pembaca layar.
export const KELOMPOK = {
  delisting: { judul: "dihapus dari bursa", catatan: "kotak bertanda “tertangkap” = alarm berbunyi sebelum kejadian" },
  watchlist: {
    judul: "berpotensi delisting (disuspensi > 6 bulan)",
    catatan: "kotak bertanda “tertangkap” = alarm berbunyi sebelum kejadian",
  },
  control: { judul: "sehat", catatan: "kotak bertanda “alarm palsu” = berbunyi padahal saham sehat" },
} as const;
