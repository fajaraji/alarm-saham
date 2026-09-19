# 33: Hapus alarm buatan sendiri

**What to build:** Alarm yang dirakit pengguna tidak bisa dihapus dari /pasang. Tambahkan tombol hapus pada alarm buatan sendiri (bukan alarm bawaan) dengan konfirmasi. Alarm di server dihapus lewat DELETE /api/alarms yang hanya menghapus alarm milik token pemilik; salinan di browser ikut dibuang, dan alarm itu keluar dari daftar alarm aktif portofolio. Sumber: feedback gelombang 2 (halaman ketiga, tidak bisa hapus alarm).

**Blocked by:** None (can start immediately)

**Status:** selesai. Tombol "Hapus" hanya pada alarm buatan sendiri, dengan dialog konfirmasi. Server dihapus lebih dulu lewat `DELETE /api/alarms?id=` (pemilik ikut di WHERE; token lain 404); bila server gagal, alarm tetap utuh di mana-mana. Salinan browser dibuang dan alarm keluar dari daftar aktif portofolio. Tes: route di PGlite in-memory (4), UI (5), e2e rakit→pasang→hapus→muat ulang lulus di kedua jalur.

- [x] Alarm buatan sendiri punya tombol hapus dengan konfirmasi; alarm bawaan tidak
- [x] DELETE /api/alarms menghapus hanya alarm milik token pengirim (token lain mendapat 404, bukan menghapus)
- [x] Sesudah dihapus, alarm tidak muncul lagi setelah muat ulang, di jalur database maupun data contoh
- [x] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
