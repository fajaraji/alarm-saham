# 40: Label 59 emiten: berpotensi delisting, bukan Papan Pemantauan Khusus

**What to build:** Kelompok 59 emiten di universe uji berasal dari pengumuman BEI Peng-S-00019/BEI.PLP/06-2026 (30 Jun 2026), yaitu daftar emiten berpotensi delisting paksa karena disuspensi lebih dari 6 bulan. Aplikasi, README, dan halaman metodologi menyebutnya "Papan Pemantauan Khusus", yang merupakan papan lain. Semua label dan istilah kamusnya dibetulkan. Sumber: audit hackathon 19–20 Sep 2026, diverifikasi ulang 20 Sep.

**Blocked by:** None (can start immediately)

**Status:** selesai. Diverifikasi ke berita pengumuman BEI (Kontan, CNBC Indonesia, IDX Channel): Peng-S-00019/BEI.PLP/06-2026 adalah daftar 59 emiten berpotensi delisting paksa karena disuspensi lebih dari 6 bulan. Istilah kamus `pemantauan_khusus` diganti `berpotensi_delisting`; label di rakit, putar ulang, overlay panduan, metodologi, dan README dibetulkan. Kolom `notes` di data benih tidak diubah karena tidak pernah tampil ke pengguna.

- [x] Tidak ada lagi teks yang menyebut 59 emiten itu "Papan Pemantauan Khusus"
- [x] Label baru menyebut sumbernya (pengumuman BEI 30 Jun 2026) dan kriterianya (suspensi lebih dari 6 bulan)
- [x] Istilah kamus diganti atau ditambah sesuai
- [x] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
