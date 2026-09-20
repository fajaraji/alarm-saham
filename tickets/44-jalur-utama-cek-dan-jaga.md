# 44: Beranda memimpin ke cek dan jaga, bukan ke rakit

**What to build:** Audit menyimpulkan inti painkiller produk ini adalah cek cepat satu saham lalu dijaga tiap pagi, sedangkan rakit blok dan uji ke masa lalu adalah fitur pengguna mahir dan bukti bagi juri. Beranda dulu menutup dengan "tiga langkah" yang menempatkan rakit sejajar dengan inti. Urutan beranda diubah: hero kotak cari, lalu ajakan memasang alarm harian, lalu contoh nyata, lalu bagian "Lihat buktinya" berisi angka uji, putar ulang, dan rakit. Sumber: audit hackathon 19–20 Sep 2026 dan persetujuan pemilik 20 Sep.

**Blocked by:** None

**Status:** selesai. Tidak ada halaman yang dihapus dan tidak ada fitur yang dibuang; hanya urutan dan label. Angka di beranda ikut memakai ukuran jujur tiket 39: tertangkap keseluruhan dan median, bukan rata-rata yang ditarik naik segelintir emiten.

- [x] Layar pertama berisi kotak cek saham, penjelasan satu kalimat, dan jalan ke Telegram
- [x] Ajakan memasang alarm harian ada sebelum bagian bukti
- [x] Rakit dan putar ulang pindah ke bagian "Lihat buktinya"
- [x] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
