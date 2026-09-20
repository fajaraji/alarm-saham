# 34: Kotak cari di kamus

**What to build:** Halaman /kamus memuat semua istilah tanpa cara mencarinya. Tambahkan kotak cari yang menyaring istilah sambil diketik (nama istilah dan penjelasannya), dengan keadaan kosong yang jelas. Tanpa JavaScript semua istilah tetap tampil. Sumber: feedback gelombang 2 (kamus, search bar).

**Blocked by:** None (can start immediately)

**Status:** ditunda (2026-09-20). Pemilik memilih mendahulukan temuan kritis audit produksi (cron, data beku, "Cek sekarang" 504, label keliru) sebelum tenggat 30 Sep; tiket ini dikerjakan bila waktu tersisa.

- [ ] Mengetik menyaring istilah; menghapus ketikan menampilkan semuanya lagi
- [ ] Tidak ada yang cocok: satu kalimat keadaan kosong
- [ ] Kotak cari berlabel, bisa dipakai dengan keyboard, lolos axe
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
