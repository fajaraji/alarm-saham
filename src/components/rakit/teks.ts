// Teks awam layar "Rakit alarm" (satu tempat agar tes & komponen sepakat).
export const TEKS = {
  judul: "Rakit alarmmu: seret blok, lalu uji ke masa lalu.",
  eyebrow: "Langkah 2 dari 3",
  paletJudul: "Kotak blok",
  paletSub: "Seret ke papan. (Klik juga bisa.)",
  papanJudul: "Papan alarm",
  papanSub: "Alarm = KALAU … syarat … MAKA bunyikan.",
  papanKosongJudul: "Seret blok syarat ke sini",
  papanKosongSub: "atau klik blok di kotak kiri, atau minta AI merakit di atas",
  kalau: "KALAU",
  kalauTeks: "saham yang kujaga …",
  maka: "MAKA",
  makaTeks: "bunyikan alarm & jelaskan ke saya",
  buang: "Seret blok ke sini untuk membuang",
  tombolUji: "Uji ke masa lalu",
  tombolKosongkan: "Kosongkan",
  tombolSimpan: "Simpan alarm ini",
  tombolAi: "Minta AI rakit",
  placeholderAi: "mis. aku mau alarm buat saham yang mau pailit",
  hasilJudul: "Hasil uji",
  aiJudul: "Penjelasan AI",
  aiBelum: "Rakit alarm dulu, lalu klik “Uji ke masa lalu”.",
  aiMemeriksa: "AI sedang memeriksa di mana alarmmu bolong…",
  aiMerakit: "AI sedang merakit blok…",
  papanKosongUji: "Papan alarm masih kosong. Klik atau seret satu blok dari kotak kiri, atau minta AI merakit.",
  sumberDb: "data Sectors nyata",
  sumberFixture: "data contoh (bukan data Sectors nyata)",
} as const;

// Catatan legenda menyebut LABEL kotak (yang juga ada di title/aria-label tiap
// sel), bukan nama warna — supaya berguna untuk pengguna buta warna dan pembaca layar.
export const KELOMPOK = {
  delisting: { judul: "dihapus dari bursa", catatan: "kotak bertanda “tertangkap” = alarm berbunyi sebelum kejadian" },
  watchlist: {
    judul: "di pemantauan khusus (peringatan dini)",
    catatan: "kotak bertanda “tertangkap” = alarm berbunyi sebelum kejadian",
  },
  control: { judul: "sehat", catatan: "kotak bertanda “alarm palsu” = berbunyi padahal saham sehat" },
} as const;
